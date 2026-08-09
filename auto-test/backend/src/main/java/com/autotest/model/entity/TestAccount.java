package com.autotest.model.entity;

import java.util.Date;

/**
 * 测试账号实体
 */
public class TestAccount {
    private Long id;
    private String accountCode;
    private String accountName;
    private Long tenantId;
    private String productCode;
    private String systemName;
    private String username;
    private String password;
    private String authType;
    private String authConfig;
    private String loginType;
    private String loginConfig;
    private String loginScript;
    private Integer status;
    private Date lastUsedTime;
    private Date lockUntil;
    private Date validFrom;
    private Date validUntil;
    private Date createTime;
    private Date updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }
    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public String getSystemName() { return systemName; }
    public void setSystemName(String systemName) { this.systemName = systemName; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getAuthType() { return authType; }
    public void setAuthType(String authType) { this.authType = authType; }
    public String getAuthConfig() { return authConfig; }
    public void setAuthConfig(String authConfig) { this.authConfig = authConfig; }
    public String getLoginType() { return loginType; }
    public void setLoginType(String loginType) { this.loginType = loginType; }
    public String getLoginConfig() { return loginConfig; }
    public void setLoginConfig(String loginConfig) { this.loginConfig = loginConfig; }
    public String getLoginScript() { return loginScript; }
    public void setLoginScript(String loginScript) { this.loginScript = loginScript; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Date getLastUsedTime() { return lastUsedTime; }
    public void setLastUsedTime(Date lastUsedTime) { this.lastUsedTime = lastUsedTime; }
    public Date getLockUntil() { return lockUntil; }
    public void setLockUntil(Date lockUntil) { this.lockUntil = lockUntil; }
    public Date getValidFrom() { return validFrom; }
    public void setValidFrom(Date validFrom) { this.validFrom = validFrom; }
    public Date getValidUntil() { return validUntil; }
    public void setValidUntil(Date validUntil) { this.validUntil = validUntil; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
}
