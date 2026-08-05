package com.autotest.model.dto;

public class NodeEditDTO {
    private Long id;
    private String nodeName;
    private String requestUrl;
    private String requestMethod;
    private String requestHeaders;
    private String bodyType;
    private String bodyData;
    private String extractRules;
    private String assertRules;
    private String variableMapping;
    private Integer delaySeconds;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
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
    public String getExtractRules() { return extractRules; }
    public void setExtractRules(String extractRules) { this.extractRules = extractRules; }
    public String getAssertRules() { return assertRules; }
    public void setAssertRules(String assertRules) { this.assertRules = assertRules; }
    public String getVariableMapping() { return variableMapping; }
    public void setVariableMapping(String variableMapping) { this.variableMapping = variableMapping; }
    public Integer getDelaySeconds() { return delaySeconds; }
    public void setDelaySeconds(Integer delaySeconds) { this.delaySeconds = delaySeconds; }
}
