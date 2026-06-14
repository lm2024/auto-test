package com.autotest.model.entity;

import java.util.Date;

public class ChainVersion {
    private Long id;
    private String chainCode;
    private String chainFingerprint;
    private Integer version;
    private String chainName;
    private Integer executeMode;
    private String description;
    private String nodeSnapshot;
    private String diffResult;
    private String aiAnalysis;
    private String status;
    private Date createTime;
    private String createBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainFingerprint() { return chainFingerprint; }
    public void setChainFingerprint(String chainFingerprint) { this.chainFingerprint = chainFingerprint; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public Integer getExecuteMode() { return executeMode; }
    public void setExecuteMode(Integer executeMode) { this.executeMode = executeMode; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getNodeSnapshot() { return nodeSnapshot; }
    public void setNodeSnapshot(String nodeSnapshot) { this.nodeSnapshot = nodeSnapshot; }
    public String getDiffResult() { return diffResult; }
    public void setDiffResult(String diffResult) { this.diffResult = diffResult; }
    public String getAiAnalysis() { return aiAnalysis; }
    public void setAiAnalysis(String aiAnalysis) { this.aiAnalysis = aiAnalysis; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }
}
