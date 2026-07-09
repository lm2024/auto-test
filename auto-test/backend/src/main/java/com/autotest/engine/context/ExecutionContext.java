package com.autotest.engine.context;

import com.autotest.model.entity.TestNodeExecuteLog;

import java.util.Date;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class ExecutionContext {
    private String executionId;
    private String chainCode;
    private ConcurrentHashMap<String, Object> variables;
    private CopyOnWriteArrayList<TestNodeExecuteLog> nodeLogs;
    private volatile boolean stopped;
    private Date startTime;
    private Date endTime;
    private String status;

    public ExecutionContext() {
        this.variables = new ConcurrentHashMap<>();
        this.nodeLogs = new CopyOnWriteArrayList<>();
        this.stopped = false;
        this.status = "RUNNING";
    }

    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public ConcurrentHashMap<String, Object> getVariables() { return variables; }
    public void setVariable(String key, Object value) { variables.put(key, value); }
    public Object getVariable(String key) { return variables.get(key); }
    public List<TestNodeExecuteLog> getNodeLogs() { return nodeLogs; }
    public void addNodeLog(TestNodeExecuteLog log) { nodeLogs.add(log); }
    public boolean isStopped() { return stopped; }
    public void setStopped(boolean stopped) { this.stopped = stopped; }
    public Date getStartTime() { return startTime; }
    public void setStartTime(Date startTime) { this.startTime = startTime; }
    public Date getEndTime() { return endTime; }
    public void setEndTime(Date endTime) { this.endTime = endTime; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
