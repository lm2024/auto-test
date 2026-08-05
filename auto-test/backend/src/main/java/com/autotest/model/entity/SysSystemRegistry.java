package com.autotest.model.entity;

import java.util.Date;

/**
 * 系统注册表实体，对应表 sys_system_registry。
 * domainPatterns / ipRanges 均为 JSON 数组字符串，用于接口内外网归属识别。
 */
public class SysSystemRegistry {
    private Long id;
    private String systemCode;
    private String systemName;
    private String scope;
    private String domainPatterns;
    private String ipRanges;
    private String category;
    private String description;
    private Date createTime;
    private Date updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSystemCode() { return systemCode; }
    public void setSystemCode(String systemCode) { this.systemCode = systemCode; }
    public String getSystemName() { return systemName; }
    public void setSystemName(String systemName) { this.systemName = systemName; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getDomainPatterns() { return domainPatterns; }
    public void setDomainPatterns(String domainPatterns) { this.domainPatterns = domainPatterns; }
    public String getIpRanges() { return ipRanges; }
    public void setIpRanges(String ipRanges) { this.ipRanges = ipRanges; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
}
