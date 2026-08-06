package com.autotest.model.entity;

import java.util.Date;

public class TestExecuteMain {
    private Long id;
    private String executionId;
    private String chainCode;
    private String status;
    private Date startTime;
    private Date endTime;
    private Long totalCostMs;
    private String errorMessage;
    private Integer nodeCount;
    private Integer successCount;
    private Integer failCount;
    private Integer skipCount;
    private Long tenantId;
    private Integer roundNumber;
    private Long taskId;
    private Date createTime;
    private Date updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getStartTime() { return startTime; }
    public void setStartTime(Date startTime) { this.startTime = startTime; }
    public Date getEndTime() { return endTime; }
    public void setEndTime(Date endTime) { this.endTime = endTime; }
    public Long getTotalCostMs() { return totalCostMs; }
    public void setTotalCostMs(Long totalCostMs) { this.totalCostMs = totalCostMs; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Integer getNodeCount() { return nodeCount; }
    public void setNodeCount(Integer nodeCount) { this.nodeCount = nodeCount; }
    public Integer getSuccessCount() { return successCount; }
    public void setSuccessCount(Integer successCount) { this.successCount = successCount; }
    public Integer getFailCount() { return failCount; }
    public void setFailCount(Integer failCount) { this.failCount = failCount; }
    public Integer getSkipCount() { return skipCount; }
    public void setSkipCount(Integer skipCount) { this.skipCount = skipCount; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public Integer getRoundNumber() { return roundNumber; }
    public void setRoundNumber(Integer roundNumber) { this.roundNumber = roundNumber; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
}
