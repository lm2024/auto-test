package com.autotest.model.dto;

import java.util.Map;

/**
 * 单节点调试请求 DTO。variables 为空时由服务端按 chainCode 加载全局/链路变量兜底。
 */
public class NodeDebugRequest {
    private String chainCode;
    private String requestUrl;
    private String requestMethod;
    private String requestHeaders;
    private String bodyType;
    private String bodyData;
    private Map<String, String> variables;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getRequestUrl() { return requestUrl; }
    public void setRequestUrl(String requestUrl) { this.requestUrl = requestUrl; }
    public String getRequestMethod() { return requestMethod; }
    public void setRequestMethod(String requestMethod) { this.requestMethod = requestMethod; }
    public String getRequestHeaders() { return requestHeaders; }
    public void setRequestHeaders(String requestHeaders) { this.requestHeaders = requestHeaders; }
    public String getBodyType() { return bodyType; }
    public void setBodyType(String bodyType) { this.bodyType = bodyType; }
    public String getBodyData() { return bodyData; }
    public void setBodyData(String bodyData) { this.bodyData = bodyData; }
    public Map<String, String> getVariables() { return variables; }
    public void setVariables(Map<String, String> variables) { this.variables = variables; }
}
