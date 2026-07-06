package com.autotest.model.entity;

import java.util.Date;

public class SysUserSso {
    private Long id;
    private Long userId;
    private String ssoProvider;
    private String ssoSubject;
    private Date createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSsoProvider() { return ssoProvider; }
    public void setSsoProvider(String ssoProvider) { this.ssoProvider = ssoProvider; }
    public String getSsoSubject() { return ssoSubject; }
    public void setSsoSubject(String ssoSubject) { this.ssoSubject = ssoSubject; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
}
