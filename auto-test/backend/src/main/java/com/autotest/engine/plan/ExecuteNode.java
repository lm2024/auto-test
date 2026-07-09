package com.autotest.engine.plan;

import com.autotest.model.entity.TestNodeConfig;

import java.util.Date;

public class ExecuteNode {
    private TestNodeConfig config;
    private String nodeId;
    private String status;
    private Date startTime;
    private Date endTime;
    private long costMs;
    private String errorMessage;

    public ExecuteNode() {
        this.status = "PENDING";
    }

    public TestNodeConfig getConfig() { return config; }
    public void setConfig(TestNodeConfig config) { this.config = config; }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getStartTime() { return startTime; }
    public void setStartTime(Date startTime) { this.startTime = startTime; }
    public Date getEndTime() { return endTime; }
    public void setEndTime(Date endTime) { this.endTime = endTime; }
    public long getCostMs() { return costMs; }
    public void setCostMs(long costMs) { this.costMs = costMs; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
