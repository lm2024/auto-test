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
}
