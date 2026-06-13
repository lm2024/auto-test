package com.autotest.model.vo;

import java.util.Date;

public class ExecuteMainVO {
    private String executionId;
    private String chainCode;
    private String chainName;
    private String status;
    private Date startTime;
    private Date endTime;
    private Long totalCostMs;
    private Integer nodeCount;
    private Integer successCount;
    private Integer failCount;
    private Integer skipCount;
    private String errorMessage;

    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getStartTime() { return startTime; }
    public void setStartTime(Date startTime) { this.startTime = startTime; }
    public Date getEndTime() { return endTime; }
    public void setEndTime(Date endTime) { this.endTime = endTime; }
    public Long getTotalCostMs() { return totalCostMs; }
    public void setTotalCostMs(Long totalCostMs) { this.totalCostMs = totalCostMs; }
    public Integer getNodeCount() { return nodeCount; }
    public void setNodeCount(Integer nodeCount) { this.nodeCount = nodeCount; }
    public Integer getSuccessCount() { return successCount; }
    public void setSuccessCount(Integer successCount) { this.successCount = successCount; }
    public Integer getFailCount() { return failCount; }
    public void setFailCount(Integer failCount) { this.failCount = failCount; }
    public Integer getSkipCount() { return skipCount; }
    public void setSkipCount(Integer skipCount) { this.skipCount = skipCount; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
