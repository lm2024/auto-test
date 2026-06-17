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
}
