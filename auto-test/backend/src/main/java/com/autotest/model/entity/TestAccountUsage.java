package com.autotest.model.entity;

import java.util.Date;

/** 可追溯的测试账号使用记录。 */
public class TestAccountUsage {
    private Long id;
    private Long accountId;
    private String accountCode;
    private Long tenantId;
    private Long userId;
    private String operatorName;
    private String executionId;
    private Long taskId;
    private String chainCode;
    private String dataPoolCode;
    private String usageType;
    private String status;
    private Date startedAt;
    private Date endedAt;
    private Long durationMs;
    private String releaseReason;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }
    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getOperatorName() { return operatorName; }
    public void setOperatorName(String operatorName) { this.operatorName = operatorName; }
    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getDataPoolCode() { return dataPoolCode; }
    public void setDataPoolCode(String dataPoolCode) { this.dataPoolCode = dataPoolCode; }
    public String getUsageType() { return usageType; }
    public void setUsageType(String usageType) { this.usageType = usageType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getStartedAt() { return startedAt; }
    public void setStartedAt(Date startedAt) { this.startedAt = startedAt; }
    public Date getEndedAt() { return endedAt; }
    public void setEndedAt(Date endedAt) { this.endedAt = endedAt; }
    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    public String getReleaseReason() { return releaseReason; }
    public void setReleaseReason(String releaseReason) { this.releaseReason = releaseReason; }
}
