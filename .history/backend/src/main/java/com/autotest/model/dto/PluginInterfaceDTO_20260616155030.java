package com.autotest.model.dto;

public class PluginInterfaceDTO {
    private String nodeName;
    private String method;
    private String url;
    private String headers;
    private String bodyData;
    private String responseData;
    private Integer sort;
    private String parallelGroup;

    // 阶段二新增字段
    private String bizOperTraceId;
    private String triggerEvent;
    private String targetDom;
    private String pageUrl;
    private String windowId;
    private Boolean ignore;

    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getHeaders() { return headers; }
    public void setHeaders(String headers) { this.headers = headers; }
    public String getBodyData() { return bodyData; }
    public void setBodyData(String bodyData) { this.bodyData = bodyData; }
    public String getResponseData() { return responseData; }
    public void setResponseData(String responseData) { this.responseData = responseData; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
    public String getParallelGroup() { return parallelGroup; }
    public void setParallelGroup(String parallelGroup) { this.parallelGroup = parallelGroup; }

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
    public Boolean getIgnore() { return ignore; }
    public void setIgnore(Boolean ignore) { this.ignore = ignore; }
}
