package com.autotest.service.impl;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.autotest.exception.BusinessException;
import com.autotest.model.entity.TestAccount;
import com.autotest.service.AccountService;
import com.autotest.service.AuthService;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import org.apache.http.cookie.Cookie;
import org.apache.http.impl.client.BasicCookieStore;
import org.apache.http.impl.cookie.BasicClientCookie;

import java.util.*;

/**
 * 认证服务实现 - Phase 4: SSO认证与Token管理
 */
@Service
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);

    @Autowired
    private AccountService accountService;

    @Override
    public Map<String, Object> getToken(String accountCode) {
        TestAccount account = accountService.acquireAccount(accountCode);
        if (account == null) {
            throw new BusinessException(404, "账号不存在: " + accountCode);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("accountCode", account.getAccountCode());
        result.put("authType", account.getAuthType());

        try {
            JSONObject config = JSON.parseObject(account.getAuthConfig());
            String authType = account.getAuthType();

            if ("TOKEN".equals(authType)) {
                result.put("accessToken", config.getString("token"));
                result.put("tokenType", "Bearer");
                result.put("expiresIn", 3600);
                return result;
            }

            if ("PASSWORD".equals(authType)) {
                String loginUrl = config.getString("loginUrl");
                if (loginUrl == null || loginUrl.isEmpty()) {
                    throw new BusinessException(400, "未配置登录地址");
                }

                JSONObject loginBody = new JSONObject();
                String usernameField = config.getString("usernameField");
                String passwordField = config.getString("passwordField");
                if (usernameField == null) usernameField = "username";
                if (passwordField == null) passwordField = "password";
                loginBody.put(usernameField, account.getUsername());
                loginBody.put(passwordField, account.getPassword());

                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig).build()) {
                    HttpPost post = new HttpPost(loginUrl);
                    post.setHeader("Content-Type", "application/json");
                    post.setEntity(new StringEntity(loginBody.toJSONString(), "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        JSONObject respJson = JSON.parseObject(respBody);
                        String tokenField = config.getString("tokenField");
                        if (tokenField == null) tokenField = "token";
                        result.put("accessToken", respJson.getString(tokenField));
                        result.put("tokenType", "Bearer");
                        if (respJson.containsKey("expiresIn")) {
                            result.put("expiresIn", respJson.get("expiresIn"));
                        }
                        if (respJson.containsKey("refresh_token")) {
                            result.put("refreshToken", respJson.getString("refresh_token"));
                        }
                        return result;
                    }
                }
            }

            if ("SSO".equals(authType)) {
                String tokenUrl = config.getString("tokenUrl");
                if (tokenUrl == null || tokenUrl.isEmpty()) {
                    throw new BusinessException(400, "未配置SSO Token地址");
                }

                String clientId = config.getString("clientId");
                String clientSecret = config.getString("clientSecret");
                String grantType = config.getString("grantType");
                if (grantType == null) grantType = "client_credentials";

                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig).build()) {
                    HttpPost post = new HttpPost(tokenUrl);
                    post.setHeader("Content-Type", "application/x-www-form-urlencoded");
                    String formBody = "grant_type=" + grantType
                            + "&client_id=" + clientId
                            + "&client_secret=" + clientSecret;
                    post.setEntity(new StringEntity(formBody, "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        JSONObject respJson = JSON.parseObject(respBody);
                        result.put("accessToken", respJson.getString("access_token"));
                        result.put("tokenType", respJson.getString("token_type"));
                        if (respJson.containsKey("expires_in")) {
                            result.put("expiresIn", respJson.get("expires_in"));
                        }
                        if (respJson.containsKey("refresh_token")) {
                            result.put("refreshToken", respJson.getString("refresh_token"));
                        }
                        return result;
                    }
                }
            }

            // ==================== Cookie 会话登录 ====================
            if ("COOKIE".equals(authType)) {
                String loginUrl = config.getString("loginUrl");
                if (loginUrl == null || loginUrl.isEmpty()) {
                    throw new BusinessException(400, "未配置登录地址");
                }

                JSONObject loginBody = new JSONObject();
                String usernameField = config.getString("usernameField") != null ? config.getString("usernameField") : "username";
                String passwordField = config.getString("passwordField") != null ? config.getString("passwordField") : "password";
                loginBody.put(usernameField, account.getUsername());
                loginBody.put(passwordField, account.getPassword());

                // 添加额外字段
                JSONObject extraFields = config.getJSONObject("extraFields");
                if (extraFields != null) {
                    loginBody.putAll(extraFields);
                }

                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                BasicCookieStore cookieStore = new BasicCookieStore();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig)
                        .setDefaultCookieStore(cookieStore)
                        .disableRedirectHandling()
                        .build()) {
                    HttpPost post = new HttpPost(loginUrl);
                    post.setHeader("Content-Type", "application/json");
                    // 添加自定义请求头
                    JSONObject headerMap = config.getJSONObject("headerMap");
                    if (headerMap != null) {
                        for (String key : headerMap.keySet()) {
                            post.setHeader(key, headerMap.getString(key));
                        }
                    }
                    post.setEntity(new StringEntity(loginBody.toJSONString(), "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        // 提取 Set-Cookie
                        Map<String, String> cookies = new LinkedHashMap<>();
                        List<Cookie> cookieList = cookieStore.getCookies();
                        if (cookieList != null) {
                            for (Cookie cookie : cookieList) {
                                cookies.put(cookie.getName(), cookie.getValue());
                            }
                        }
                        // 也从响应头提取 Set-Cookie
                        org.apache.http.Header[] setCookieHeaders = response.getHeaders("Set-Cookie");
                        for (org.apache.http.Header header : setCookieHeaders) {
                            String headerVal = header.getValue();
                            String[] parts = headerVal.split(";")[0].split("=", 2);
                            if (parts.length == 2) {
                                cookies.put(parts[0].trim(), parts[1].trim());
                            }
                        }

                        result.put("cookies", cookies);
                        result.put("cookieHeader", buildCookieHeader(cookies));

                        // 尝试从响应体提取 token（可选）
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        if (respBody != null && !respBody.isEmpty()) {
                            try {
                                JSONObject respJson = JSON.parseObject(respBody);
                                String tokenField = config.getString("tokenField");
                                if (tokenField != null && respJson.containsKey(tokenField)) {
                                    result.put("accessToken", respJson.getString(tokenField));
                                    result.put("tokenType", "Bearer");
                                }
                            } catch (Exception ignored) {
                                // 响应体不是 JSON，忽略
                            }
                        }
                        return result;
                    }
                }
            }

            // ==================== OAuth2 授权码登录 ====================
            if ("OAUTH2_CODE".equals(authType)) {
                String tokenUrl = config.getString("tokenUrl");
                String clientId = config.getString("clientId");
                String clientSecret = config.getString("clientSecret");
                String redirectUri = config.getString("redirectUri");
                String scope = config.getString("scope");

                if (tokenUrl == null || clientId == null) {
                    throw new BusinessException(400, "OAuth2 配置不完整（需要 tokenUrl, clientId）");
                }

                // 客户端模式直接获取 token
                String grantType = config.getString("grantType") != null ? config.getString("grantType") : "client_credentials";

                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig).build()) {
                    HttpPost post = new HttpPost(tokenUrl);
                    post.setHeader("Content-Type", "application/x-www-form-urlencoded");

                    StringBuilder formBody = new StringBuilder();
                    formBody.append("grant_type=").append(grantType);
                    formBody.append("&client_id=").append(clientId);
                    if (clientSecret != null) {
                        formBody.append("&client_secret=").append(clientSecret);
                    }
                    if ("authorization_code".equals(grantType)) {
                        // 授权码模式需要 code 参数
                        String code = config.getString("code");
                        if (code == null || code.isEmpty()) {
                            throw new BusinessException(400, "授权码模式需要提供 code 参数");
                        }
                        formBody.append("&code=").append(code);
                        if (redirectUri != null) {
                            formBody.append("&redirect_uri=").append(redirectUri);
                        }
                    }
                    if (scope != null) {
                        formBody.append("&scope=").append(scope);
                    }

                    post.setEntity(new StringEntity(formBody.toString(), "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        JSONObject respJson = JSON.parseObject(respBody);
                        result.put("accessToken", respJson.getString("access_token"));
                        result.put("tokenType", respJson.getString("token_type") != null ? respJson.getString("token_type") : "Bearer");
                        if (respJson.containsKey("expires_in")) {
                            result.put("expiresIn", respJson.get("expires_in"));
                        }
                        if (respJson.containsKey("refresh_token")) {
                            result.put("refreshToken", respJson.getString("refresh_token"));
                        }
                        return result;
                    }
                }
            }

            // ==================== CAS 登录 ====================
            if ("CAS".equals(authType)) {
                String casServerUrl = config.getString("casServerUrl");
                String serviceUrl = config.getString("serviceUrl");
                String loginUrl = config.getString("loginUrl");

                if (casServerUrl == null || serviceUrl == null) {
                    throw new BusinessException(400, "CAS 配置不完整（需要 casServerUrl, serviceUrl）");
                }

                // CAS REST API 登录: POST /v1/tickets
                String ticketUrl = casServerUrl + (casServerUrl.endsWith("/") ? "" : "/") + "v1/tickets";
                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig)
                        .disableRedirectHandling()
                        .build()) {
                    // 1. 获取 TGT (Ticket Granting Ticket)
                    HttpPost post = new HttpPost(ticketUrl);
                    post.setHeader("Content-Type", "application/x-www-form-urlencoded");
                    String formBody = "username=" + account.getUsername()
                            + "&password=" + account.getPassword();
                    post.setEntity(new StringEntity(formBody, "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        int statusCode = response.getStatusLine().getStatusCode();
                        if (statusCode != 201) {
                            String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                            throw new BusinessException(401, "CAS 认证失败: " + respBody);
                        }
                        // 从 Location 头提取 TGT URL
                        org.apache.http.Header locationHeader = response.getFirstHeader("Location");
                        if (locationHeader == null) {
                            throw new BusinessException(500, "CAS 未返回 TGT Location");
                        }
                        String tgtUrl = locationHeader.getValue();

                        // 2. 用 TGT 获取 ST (Service Ticket)
                        HttpPost stPost = new HttpPost(tgtUrl);
                        stPost.setHeader("Content-Type", "application/x-www-form-urlencoded");
                        stPost.setEntity(new StringEntity("service=" + serviceUrl, "UTF-8"));
                        try (CloseableHttpResponse stResponse = client.execute(stPost)) {
                            String st = EntityUtils.toString(stResponse.getEntity(), "UTF-8").trim();
                            result.put("accessToken", st);
                            result.put("tokenType", "CAS");
                            result.put("casTicket", st);
                            result.put("serviceUrl", serviceUrl);
                            return result;
                        }
                    }
                }
            }

            throw new BusinessException(400, "不支持的认证类型: " + authType);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Auth] 获取token失败: accountCode={}", accountCode, e);
            throw new BusinessException(500, "获取token失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> refreshToken(String accountCode, String refreshToken) {
        TestAccount account = accountService.getAccount(
                accountService.listAccounts(null, null, 0, 10000).stream()
                        .filter(a -> a.getAccountCode().equals(accountCode))
                        .findFirst()
                        .orElseThrow(() -> new BusinessException(404, "账号不存在"))
                        .getId());

        Map<String, Object> result = new HashMap<>();
        try {
            JSONObject config = JSON.parseObject(account.getAuthConfig());
            String tokenUrl = config.getString("refreshTokenUrl");
            if (tokenUrl == null) tokenUrl = config.getString("tokenUrl");

            if (tokenUrl != null) {
                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig).build()) {
                    HttpPost post = new HttpPost(tokenUrl);
                    post.setHeader("Content-Type", "application/x-www-form-urlencoded");
                    String formBody = "grant_type=refresh_token&refresh_token=" + refreshToken
                            + "&client_id=" + config.getString("clientId")
                            + "&client_secret=" + config.getString("clientSecret");
                    post.setEntity(new StringEntity(formBody, "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        JSONObject respJson = JSON.parseObject(respBody);
                        result.put("accessToken", respJson.getString("access_token"));
                        result.put("tokenType", respJson.getString("token_type"));
                        if (respJson.containsKey("expires_in")) {
                            result.put("expiresIn", respJson.get("expires_in"));
                        }
                        if (respJson.containsKey("refresh_token")) {
                            result.put("refreshToken", respJson.getString("refresh_token"));
                        }
                        return result;
                    }
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Auth] 刷新token失败: accountCode={}", accountCode, e);
            throw new BusinessException(500, "刷新token失败: " + e.getMessage());
        }

        throw new BusinessException(400, "未配置token刷新地址");
    }

    @Override
    public Map<String, Object> validateToken(String token) {
        Map<String, Object> result = new HashMap<>();
        if (token == null || token.isEmpty()) {
            result.put("valid", false);
            result.put("message", "token为空");
            return result;
        }

        try {
            String[] parts = token.split("\\.");
            if (parts.length == 3) {
                // JWT format - decode payload
                String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
                JSONObject payloadJson = JSON.parseObject(payload);
                long exp = payloadJson.getLongValue("exp");
                long now = System.currentTimeMillis() / 1000;
                result.put("valid", exp > now);
                result.put("expiresAt", new Date(exp * 1000));
                result.put("expired", exp <= now);
                if (payloadJson.containsKey("sub")) {
                    result.put("subject", payloadJson.getString("sub"));
                }
            } else {
                result.put("valid", true);
                result.put("message", "非JWT格式，视为有效");
            }
        } catch (Exception e) {
            result.put("valid", true);
            result.put("message", "无法解析JWT，视为有效token");
        }
        return result;
    }

    /**
     * 构建 Cookie 请求头
     */
    private String buildCookieHeader(Map<String, String> cookies) {
        if (cookies == null || cookies.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : cookies.entrySet()) {
            if (sb.length() > 0) sb.append("; ");
            sb.append(entry.getKey()).append("=").append(entry.getValue());
        }
        return sb.toString();
    }
}
