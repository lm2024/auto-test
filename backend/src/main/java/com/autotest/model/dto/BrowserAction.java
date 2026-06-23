package com.autotest.model.dto;

public class BrowserAction {

    private Integer stepIndex;
    private String actionType;
    private String actionName;
    private String targetSelector;
    private String targetFrame;
    private String targetUrl;
    private String value;
    private Integer waitDelayMs;
    private Integer timeoutMs;
    private String assertType;
    private String assertValue;
    private String description;
    private boolean continueOnFail;
    private String extConfig;

    public Integer getStepIndex() { return stepIndex; }
    public void setStepIndex(Integer stepIndex) { this.stepIndex = stepIndex; }
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public String getActionName() { return actionName; }
    public void setActionName(String actionName) { this.actionName = actionName; }
    public String getTargetSelector() { return targetSelector; }
    public void setTargetSelector(String targetSelector) { this.targetSelector = targetSelector; }
    public String getTargetFrame() { return targetFrame; }
    public void setTargetFrame(String targetFrame) { this.targetFrame = targetFrame; }
    public String getTargetUrl() { return targetUrl; }
    public void setTargetUrl(String targetUrl) { this.targetUrl = targetUrl; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public Integer getWaitDelayMs() { return waitDelayMs; }
    public void setWaitDelayMs(Integer waitDelayMs) { this.waitDelayMs = waitDelayMs; }
    public Integer getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(Integer timeoutMs) { this.timeoutMs = timeoutMs; }
    public String getAssertType() { return assertType; }
    public void setAssertType(String assertType) { this.assertType = assertType; }
    public String getAssertValue() { return assertValue; }
    public void setAssertValue(String assertValue) { this.assertValue = assertValue; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isContinueOnFail() { return continueOnFail; }
    public void setContinueOnFail(boolean continueOnFail) { this.continueOnFail = continueOnFail; }
    public String getExtConfig() { return extConfig; }
    public void setExtConfig(String extConfig) { this.extConfig = extConfig; }
}
