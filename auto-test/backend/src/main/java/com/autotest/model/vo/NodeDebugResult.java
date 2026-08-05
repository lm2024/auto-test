package com.autotest.model.vo;

/**
 * 单节点调试结果 VO。请求失败时 error 非空，statusCode 可能为空。
 */
public class NodeDebugResult {
    private Integer statusCode;
    private String headers;
    private String body;
    private Long durationMs;
    private String error;

    public Integer getStatusCode() { return statusCode; }
    public void setStatusCode(Integer statusCode) { this.statusCode = statusCode; }
    public String getHeaders() { return headers; }
    public void setHeaders(String headers) { this.headers = headers; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
