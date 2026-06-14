package com.autotest.model.dto;

import java.util.List;

public class ReplayPushDTO {
    private String chainCode;
    private String chainName;
    private List<ReplayNodeDTO> replayNodes;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public List<ReplayNodeDTO> getReplayNodes() { return replayNodes; }
    public void setReplayNodes(List<ReplayNodeDTO> replayNodes) { this.replayNodes = replayNodes; }
}
