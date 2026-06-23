package com.autotest.model.entity;

import java.util.Date;

public class TestChain {
    private Long id;
    private String chainCode;
    private String chainName;
    private Integer executeMode;
    private String description;
    private Date createTime;
    private Date updateTime;
    private String createBy;
    private Integer status;
    private Integer currentVersion;
    private String chainFingerprint;

    // 阶段二新增字段
    private String bizOperTraceId;
    private String accountCode;
    private String systemCategory;
    private String funcCategory;
    private Integer priority;

    // 浏览器自动化类型
    private String chainType;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public Integer getExecuteMode() { return executeMode; }
    public void setExecuteMode(Integer executeMode) { this.executeMode = executeMode; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(Integer currentVersion) { this.currentVersion = currentVersion; }
    public String getChainFingerprint() { return chainFingerprint; }
    public void setChainFingerprint(String chainFingerprint) { this.chainFingerprint = chainFingerprint; }

    // 阶段二新增字段 getter/setter
    public String getBizOperTraceId() { return bizOperTraceId; }
    public void setBizOperTraceId(String bizOperTraceId) { this.bizOperTraceId = bizOperTraceId; }
    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }
    public String getSystemCategory() { return systemCategory; }
    public void setSystemCategory(String systemCategory) { this.systemCategory = systemCategory; }
    public String getFuncCategory() { return funcCategory; }
    public void setFuncCategory(String funcCategory) { this.funcCategory = funcCategory; }
    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }
    public String getChainType() { return chainType; }
    public void setChainType(String chainType) { this.chainType = chainType; }
}
