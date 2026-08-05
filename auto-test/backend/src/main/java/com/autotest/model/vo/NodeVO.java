package com.autotest.model.vo;

public class NodeVO {
    private Long id;
    private Long nodeId;
    private String nodeCode;
    private String nodeName;
    private String nodeType;
    private String requestUrl;
    private String requestMethod;
    private String requestHeaders;
    private String bodyType;
    private String bodyData;
    private String extractRules;
    private String assertRules;
    private String variableMapping;
    private Integer delaySeconds;

    // 阶段二新增字段
    private String bizOperTraceId;
    private String triggerEvent;
    private String targetDom;
    private String pageUrl;
    private String windowId;
    private Integer isIgnored;

    // 内外网识别新增字段
    private String interfaceScope;
    private String targetSystem;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNodeId() { return nodeId; }
    public void setNodeId(Long nodeId) { this.nodeId = nodeId; }
    public String getNodeCode() { return nodeCode; }
    public void setNodeCode(String nodeCode) { this.nodeCode = nodeCode; }
    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
    public String getNodeType() { return nodeType; }
    public void setNodeType(String nodeType) { this.nodeType = nodeType; }
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

    // 阶段二新增字段 getter/setter
    public String getBizOperTraceId() { return bizOperTraceId; }
    public void setBizOperTraceId(String bizOperTraceId) { this.bizOperTraceId = bizOperTraceId; }
    public String getTriggerEvent() { return triggerEvent; }
    public void setTriggerEvent(String triggerEvent) { this.triggerEvent = triggerEvent; }
    public String getTargetDom() { return targetDom; }
    public void setTargetDom(String targetDom) { this.targetDom = targetDom; }
    public String getPageUrl() { return pageUrl; }
    public void setPageUrl(String pageUrl) { this.pageUrl = pageUrl; }
    public String getWindowId() { return windowId; }
    public void setWindowId(String windowId) { this.windowId = windowId; }
    public Integer getIsIgnored() { return isIgnored; }
    public void setIsIgnored(Integer isIgnored) { this.isIgnored = isIgnored; }

    // 内外网识别新增字段 getter/setter
    public String getInterfaceScope() { return interfaceScope; }
    public void setInterfaceScope(String interfaceScope) { this.interfaceScope = interfaceScope; }
    public String getTargetSystem() { return targetSystem; }
    public void setTargetSystem(String targetSystem) { this.targetSystem = targetSystem; }
}
