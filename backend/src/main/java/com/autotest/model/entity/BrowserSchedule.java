package com.autotest.model.entity;

import java.util.Date;

public class BrowserSchedule {
    private Long id;
    private String chainCode;
    private String cronExpression;
    private String scheduleName;
    private Integer enabled;
    private Date lastRunTime;
    private Date nextRunTime;
    private Integer notifyOnFail;
    private Date createTime;
    private Date updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    public String getScheduleName() { return scheduleName; }
    public void setScheduleName(String scheduleName) { this.scheduleName = scheduleName; }
    public Integer getEnabled() { return enabled; }
    public void setEnabled(Integer enabled) { this.enabled = enabled; }
    public Date getLastRunTime() { return lastRunTime; }
    public void setLastRunTime(Date lastRunTime) { this.lastRunTime = lastRunTime; }
    public Date getNextRunTime() { return nextRunTime; }
    public void setNextRunTime(Date nextRunTime) { this.nextRunTime = nextRunTime; }
    public Integer getNotifyOnFail() { return notifyOnFail; }
    public void setNotifyOnFail(Integer notifyOnFail) { this.notifyOnFail = notifyOnFail; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
}
