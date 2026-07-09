package com.autotest.model.vo;

import java.util.List;

/**
 * TraceId分组聚合VO
 */
public class TraceGroupVO {
    private String traceId;
    private String triggerEvent;
    private String pageUrl;
    private Integer nodeCount;
    private List<NodeVO> nodes;

    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public String getTriggerEvent() { return triggerEvent; }
    public void setTriggerEvent(String triggerEvent) { this.triggerEvent = triggerEvent; }
    public String getPageUrl() { return pageUrl; }
    public void setPageUrl(String pageUrl) { this.pageUrl = pageUrl; }
    public Integer getNodeCount() { return nodeCount; }
    public void setNodeCount(Integer nodeCount) { this.nodeCount = nodeCount; }
    public List<NodeVO> getNodes() { return nodes; }
    public void setNodes(List<NodeVO> nodes) { this.nodes = nodes; }
}
