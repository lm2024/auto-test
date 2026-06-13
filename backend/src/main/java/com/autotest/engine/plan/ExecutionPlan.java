package com.autotest.engine.plan;

import com.autotest.model.entity.TestNodeConfig;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class ExecutionPlan {
    private String executionId;
    private String chainCode;
    private List<ExecutionGroup> groups;
    private int totalNodes;

    public ExecutionPlan() {
        this.groups = new ArrayList<>();
    }

    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public List<ExecutionGroup> getGroups() { return groups; }
    public void setGroups(List<ExecutionGroup> groups) { this.groups = groups; }
    public int getTotalNodes() { return totalNodes; }
    public void setTotalNodes(int totalNodes) { this.totalNodes = totalNodes; }
}
