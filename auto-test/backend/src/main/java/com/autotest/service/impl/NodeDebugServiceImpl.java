package com.autotest.service.impl;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.autotest.model.dto.NodeDebugRequest;
import com.autotest.model.vo.NodeDebugResult;
import com.autotest.service.GlobalVariableService;
import com.autotest.service.NodeDebugService;
import com.autotest.util.FileUploadUtil;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.NameValuePair;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpEntityEnclosingRequestBase;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpHead;
import org.apache.http.client.methods.HttpOptions;
import org.apache.http.client.methods.HttpPatch;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.message.BasicNameValuePair;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 单节点调试服务实现：变量替换 + 按 bodyType 组装请求体，使用 Apache HttpClient 发送，超时 30 秒。
 * 所有异常都收敛到 NodeDebugResult.error，不向上抛出。
 */
@Service
public class NodeDebugServiceImpl implements NodeDebugService {

    private static final Logger log = LoggerFactory.getLogger(NodeDebugServiceImpl.class);

    private static final int TIMEOUT_MS = 30000;
    private static final String UTF8 = "UTF-8";
    private static final Pattern VAR_PATTERN = Pattern.compile("\\$\\{([^}]+)\\}");

    @Autowired
    private GlobalVariableService globalVariableService;

    @Override
    public NodeDebugResult debug(NodeDebugRequest request) {
        NodeDebugResult result = new NodeDebugResult();
        long startTime = System.currentTimeMillis();
        try {
            if (request == null || request.getRequestUrl() == null || request.getRequestUrl().trim().isEmpty()) {
                result.setDurationMs(0L);
                result.setError("请求URL不能为空");
                return result;
            }

            Map<String, String> vars = request.getVariables();
            if (vars == null || vars.isEmpty()) {
                vars = globalVariableService.loadVariableMap(request.getChainCode());
            }
            if (vars == null) {
                vars = new HashMap<String, String>();
            }

            String url = resolveVars(request.getRequestUrl().trim(), vars);
            String headersJson = resolveVars(request.getRequestHeaders(), vars);
            String body = resolveVars(request.getBodyData(), vars);
            String method = request.getRequestMethod() == null || request.getRequestMethod().trim().isEmpty()
                    ? "GET" : request.getRequestMethod().trim().toUpperCase();
            String bodyType = request.getBodyType() == null || request.getBodyType().trim().isEmpty()
                    ? "json" : request.getBodyType().trim().toLowerCase();

            executeHttp(method, url, headersJson, body, bodyType, result);
        } catch (Exception e) {
            log.warn("[NodeDebug] 调试失败: {}", e.getMessage());
            result.setError(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        } finally {
            result.setDurationMs(System.currentTimeMillis() - startTime);
        }
        return result;
    }

    /**
     * 组装并发送 HTTP 请求，把响应写入 result
     */
    private void executeHttp(String method, String url, String headersJson, String body,
                             String bodyType, NodeDebugResult result) throws Exception {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(TIMEOUT_MS)
                .setSocketTimeout(TIMEOUT_MS)
                .setConnectionRequestTimeout(TIMEOUT_MS)
                .build();

        HttpRequestBase httpRequest = createRequest(method, url);
        if (httpRequest instanceof HttpEntityEnclosingRequestBase && body != null && !body.isEmpty()) {
            HttpEntity entity = buildEntity(bodyType, body);
            if (entity != null) {
                ((HttpEntityEnclosingRequestBase) httpRequest).setEntity(entity);
            }
        }
        applyHeaders(httpRequest, headersJson);

        CloseableHttpClient httpClient = HttpClients.custom()
                .setDefaultRequestConfig(requestConfig)
                .build();
        try {
            CloseableHttpResponse response = httpClient.execute(httpRequest);
            try {
                result.setStatusCode(Integer.valueOf(response.getStatusLine().getStatusCode()));
                result.setHeaders(buildResponseHeaders(response.getAllHeaders()));
                if (response.getEntity() != null) {
                    result.setBody(EntityUtils.toString(response.getEntity(), UTF8));
                } else {
                    result.setBody("");
                }
            } finally {
                response.close();
            }
        } finally {
            httpClient.close();
        }
    }

    /**
     * 按方法名创建请求对象
     */
    private HttpRequestBase createRequest(String method, String url) {
        if ("POST".equals(method)) {
            return new HttpPost(url);
        }
        if ("PUT".equals(method)) {
            return new HttpPut(url);
        }
        if ("PATCH".equals(method)) {
            return new HttpPatch(url);
        }
        if ("DELETE".equals(method)) {
            return new HttpDelete(url);
        }
        if ("HEAD".equals(method)) {
            return new HttpHead(url);
        }
        if ("OPTIONS".equals(method)) {
            return new HttpOptions(url);
        }
        return new HttpGet(url);
    }

    /**
     * 按 bodyType 组装请求体：json / form-data / x-www-form-urlencoded / raw / binary
     */
    private HttpEntity buildEntity(String bodyType, String body) {
        if ("json".equals(bodyType)) {
            return new StringEntity(body, ContentType.create("application/json", UTF8));
        }
        if ("x-www-form-urlencoded".equals(bodyType)) {
            return buildFormUrlEncodedEntity(body);
        }
        if ("form-data".equals(bodyType)) {
            return buildMultipartEntity(body);
        }
        if ("raw".equals(bodyType)) {
            return new StringEntity(body, ContentType.create("text/plain", UTF8));
        }
        if ("binary".equals(bodyType)) {
            byte[] bytes;
            try {
                bytes = Base64.getDecoder().decode(body.trim());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("binary 类型仅支持 base64 编码的字符串，当前 bodyData 不是合法 base64");
            }
            return new ByteArrayEntity(bytes, ContentType.APPLICATION_OCTET_STREAM);
        }
        if ("file".equals(bodyType)) {
            if (body == null || !body.startsWith("FILE_")) {
                throw new IllegalArgumentException("file 类型需要 bodyData 为上传后的 fileId（以 FILE_ 开头），当前为: " + body);
            }
            HttpEntity fileEntity = FileUploadUtil.buildFileMultipartEntity(body);
            if (fileEntity == null) {
                throw new IllegalArgumentException("未找到已上传的文件，fileId: " + body);
            }
            return fileEntity;
        }
        throw new IllegalArgumentException("不支持的 bodyType: " + bodyType);
    }

    /**
     * 表单编码体：bodyData 为 JSON 对象时按键值编码，否则按原始 a=1&b=2 串发送
     */
    private HttpEntity buildFormUrlEncodedEntity(String body) {
        JSONObject json = tryParseObject(body);
        if (json == null) {
            return new StringEntity(body, ContentType.create("application/x-www-form-urlencoded", UTF8));
        }
        List<NameValuePair> pairs = new ArrayList<NameValuePair>();
        for (String key : json.keySet()) {
            Object value = json.get(key);
            pairs.add(new BasicNameValuePair(key, value == null ? "" : String.valueOf(value)));
        }
        return new UrlEncodedFormEntity(pairs, Charset.forName(UTF8));
    }

    /**
     * multipart 表单体：仅支持 JSON 对象描述的文本字段。
     * 文件二进制请使用 bodyType=file（走 FileUploadUtil 组装 multipart/form-data）。
     */
    private HttpEntity buildMultipartEntity(String body) {
        JSONObject json = tryParseObject(body);
        if (json == null) {
            throw new IllegalArgumentException("form-data 类型的 bodyData 需要是 JSON 对象，如 {\"key\":\"value\"}");
        }
        MultipartEntityBuilder builder = MultipartEntityBuilder.create();
        builder.setCharset(Charset.forName(UTF8));
        for (String key : json.keySet()) {
            Object value = json.get(key);
            builder.addTextBody(key, value == null ? "" : String.valueOf(value),
                    ContentType.create("text/plain", UTF8));
        }
        return builder.build();
    }

    /**
     * 设置请求头，用户显式指定的 Content-Type 优先于实体默认值
     */
    private void applyHeaders(HttpRequestBase httpRequest, String headersJson) {
        if (headersJson == null || headersJson.trim().isEmpty()) {
            return;
        }
        JSONObject headers = tryParseObject(headersJson);
        if (headers == null) {
            log.warn("[NodeDebug] 请求头不是合法JSON，已忽略: {}", headersJson);
            return;
        }
        for (String key : headers.keySet()) {
            Object value = headers.get(key);
            if (value != null) {
                httpRequest.setHeader(key, String.valueOf(value));
            }
        }
    }

    /**
     * 响应头转 JSON 字符串
     */
    private String buildResponseHeaders(Header[] headers) {
        JSONObject json = new JSONObject(true);
        if (headers != null) {
            for (Header header : headers) {
                json.put(header.getName(), header.getValue());
            }
        }
        return json.toJSONString();
    }

    /**
     * 变量替换：${varName} 用 vars 中的值替换，找不到的占位符原样保留
     */
    private String resolveVars(String text, Map<String, String> vars) {
        if (text == null || text.isEmpty() || vars == null || vars.isEmpty()) {
            return text;
        }
        Matcher matcher = VAR_PATTERN.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String varName = matcher.group(1).trim();
            String value = vars.get(varName);
            if (value == null) {
                // 未绑定的占位符原样保留，便于用户排查
                matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
            } else {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(value));
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private JSONObject tryParseObject(String text) {
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        String trimmed = text.trim();
        if (!trimmed.startsWith("{")) {
            return null;
        }
        try {
            return JSON.parseObject(trimmed);
        } catch (Exception e) {
            return null;
        }
    }
}
