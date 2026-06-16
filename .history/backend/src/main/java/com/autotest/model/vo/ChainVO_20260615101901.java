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
}
