package com.autotest.engine.plan;

import java.util.ArrayList;
import java.util.List;

public class ExecutionGroup {
    private String groupName;
    private List<ExecuteNode> nodes;
    private int groupSortNo;
    private volatile boolean completed;
    private volatile boolean failed;

    public ExecutionGroup() {
        this.nodes = new ArrayList<>();
        this.completed = false;
        this.failed = false;
    }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public List<ExecuteNode> getNodes() { return nodes; }
    public void setNodes(List<ExecuteNode> nodes) { this.nodes = nodes; }
    public int getGroupSortNo() { return groupSortNo; }
    public void setGroupSortNo(int groupSortNo) { this.groupSortNo = groupSortNo; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public boolean isFailed() { return failed; }
    public void setFailed(boolean failed) { this.failed = failed; }
}
