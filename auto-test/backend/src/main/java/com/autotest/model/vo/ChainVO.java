package com.autotest.model.vo;

import java.util.Date;
import java.util.List;

public class ChainVO {
    private Long chainId;
    private String chainCode;
    private String chainName;
    private Integer executeMode;
    private String description;
    private Integer nodeCount;
    private Date createTime;
    private Date updateTime;
    private List<NodeVO> nodeList;

    // 阶段二新增字段
    private String bizOperTraceId;
    private String accountCode;
    private String systemCategory;
    private String funcCategory;
    private Integer priority;

    // 阶段三新增字段
    private Long categoryId;

    public Long getChainId() { return chainId; }
    public void setChainId(Long chainId) { this.chainId = chainId; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public Integer getExecuteMode() { return executeMode; }
    public void setExecuteMode(Integer executeMode) { this.executeMode = executeMode; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getNodeCount() { return nodeCount; }
    public void setNodeCount(Integer nodeCount) { this.nodeCount = nodeCount; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    public List<NodeVO> getNodeList() { return nodeList; }
    public void setNodeList(List<NodeVO> nodeList) { this.nodeList = nodeList; }

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

    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
}
