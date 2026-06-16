package com.autotest.model.entity;

import java.util.Date;

public class TestNodeConfig {
    private Long id;
    private String chainCode;
    private Long nodeId;
    private String nodeCode;
    private String nodeName;
    private String nodeType;
    private Integer sortNo;
    private String parallelGroup;
    private String requestUrl;
    private String requestMethod;
    private String requestHeaders;
    private String bodyType;
    private String bodyData;
    private String extractRules;
    private String assertRules;
    private String variableMapping;
    private Integer delaySeconds;
    private Date createTime;
    private Date updateTime;

    // 阶段二新增字段
    private String bizOperTraceId;
    private String triggerEvent;
    private String targetDom;
    private String pageUrl;
    private String windowId;
    private Integer isIgnored;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public Long getNodeId() { return nodeId; }
    public void setNodeId(Long nodeId) { this.nodeId = nodeId; }
    public String getNodeCode() { return nodeCode; }
    public void setNodeCode(String nodeCode) { this.nodeCode = nodeCode; }
    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
    public String getNodeType() { return nodeType; }
    public void setNodeType(String nodeType) { this.nodeType = nodeType; }
    public Integer getSortNo() { return sortNo; }
    public void setSortNo(Integer sortNo) { this.sortNo = sortNo; }
    public String getParallelGroup() { return parallelGroup; }
    public void setParallelGroup(String parallelGroup) { this.parallelGroup = parallelGroup; }
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
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }

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
}
