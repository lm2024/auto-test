package com.autotest.model.dto;

import java.util.Date;

/**
 * 测试账号创建/更新 DTO
 */
public class AccountCreateDTO {
    private String accountCode;
    private String accountName;
    private String systemName;
    private String username;
    private String password;
    private String authType;
    private String authConfig;
    private String loginType;
    private String loginConfig;
    private Long tenantId;
    private String productCode;
    private Date validFrom;
    private Date validUntil;

    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }
    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }
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
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public Date getValidFrom() { return validFrom; }
    public void setValidFrom(Date validFrom) { this.validFrom = validFrom; }
    public Date getValidUntil() { return validUntil; }
    public void setValidUntil(Date validUntil) { this.validUntil = validUntil; }
}
