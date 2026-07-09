package com.autotest.model.vo;

import java.util.List;

public class DiffVO {
    private String chainCode;
    private Integer currentVersion;
    private Integer compareVersion;
    private List<DiffNodeVO> nodes;
    private VersionVO.DiffSummary summary;
    private AiAnalysisVO aiAnalysis;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public Integer getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(Integer currentVersion) { this.currentVersion = currentVersion; }
    public Integer getCompareVersion() { return compareVersion; }
    public void setCompareVersion(Integer compareVersion) { this.compareVersion = compareVersion; }
    public List<DiffNodeVO> getNodes() { return nodes; }
    public void setNodes(List<DiffNodeVO> nodes) { this.nodes = nodes; }
    public VersionVO.DiffSummary getSummary() { return summary; }
    public void setSummary(VersionVO.DiffSummary summary) { this.summary = summary; }
    public AiAnalysisVO getAiAnalysis() { return aiAnalysis; }
    public void setAiAnalysis(AiAnalysisVO aiAnalysis) { this.aiAnalysis = aiAnalysis; }
}
