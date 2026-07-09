package com.autotest.model.vo;

public class VersionVO {
    private Long versionId;
    private Integer version;
    private String chainCode;
    private String chainName;
    private Integer nodeCount;
    private DiffSummary diffSummary;
    private java.util.Date createTime;
    private String createBy;

    public Long getVersionId() { return versionId; }
    public void setVersionId(Long versionId) { this.versionId = versionId; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public Integer getNodeCount() { return nodeCount; }
    public void setNodeCount(Integer nodeCount) { this.nodeCount = nodeCount; }
    public DiffSummary getDiffSummary() { return diffSummary; }
    public void setDiffSummary(DiffSummary diffSummary) { this.diffSummary = diffSummary; }
    public java.util.Date getCreateTime() { return createTime; }
    public void setCreateTime(java.util.Date createTime) { this.createTime = createTime; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }

    public static class DiffSummary {
        private int added;
        private int removed;
        private int modified;
        private int unchanged;

        public int getAdded() { return added; }
        public void setAdded(int added) { this.added = added; }
        public int getRemoved() { return removed; }
        public void setRemoved(int removed) { this.removed = removed; }
        public int getModified() { return modified; }
        public void setModified(int modified) { this.modified = modified; }
        public int getUnchanged() { return unchanged; }
        public void setUnchanged(int unchanged) { this.unchanged = unchanged; }
    }
}
