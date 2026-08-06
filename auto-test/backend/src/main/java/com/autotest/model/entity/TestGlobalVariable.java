package com.autotest.model.entity;

import java.util.Date;

/**
 * 全局/链路级变量实体，对应表 test_global_variable。
 * varScope=GLOBAL 时 chainCode 为空串；varScope=CHAIN 时归属指定链路。
 */
public class TestGlobalVariable {
    private Long id;
    private String varScope;
    private String chainCode;
    private String varName;
    private String varValue;
    private String varType;
    private Integer isEncrypted;
    private String description;
    private Long tenantId;
    private Date createTime;
    private Date updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getVarScope() { return varScope; }
    public void setVarScope(String varScope) { this.varScope = varScope; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getVarName() { return varName; }
    public void setVarName(String varName) { this.varName = varName; }
    public String getVarValue() { return varValue; }
    public void setVarValue(String varValue) { this.varValue = varValue; }
    public String getVarType() { return varType; }
    public void setVarType(String varType) { this.varType = varType; }
    public Integer getIsEncrypted() { return isEncrypted; }
    public void setIsEncrypted(Integer isEncrypted) { this.isEncrypted = isEncrypted; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
}
