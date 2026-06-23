package com.autotest.model.dto;

public class AiScreenshotAnalyzeDTO {
    private String screenshotBase64;
    private String taskDescription;

    public String getScreenshotBase64() { return screenshotBase64; }
    public void setScreenshotBase64(String screenshotBase64) { this.screenshotBase64 = screenshotBase64; }
    public String getTaskDescription() { return taskDescription; }
    public void setTaskDescription(String taskDescription) { this.taskDescription = taskDescription; }
}
