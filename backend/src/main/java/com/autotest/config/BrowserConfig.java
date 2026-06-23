package com.autotest.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "browser.automation")
public class BrowserConfig {

    private boolean headless = true;
    private String browserType = "chromium";
    private String screenshotDir = "./screenshots";
    private String screenshotFormat = "png";
    private int defaultTimeout = 30000;
    private int defaultWait = 500;
    private int maxSessions = 5;
    private int cleanupHours = 24;

    public boolean isHeadless() { return headless; }
    public void setHeadless(boolean headless) { this.headless = headless; }
    public String getBrowserType() { return browserType; }
    public void setBrowserType(String browserType) { this.browserType = browserType; }
    public String getScreenshotDir() { return screenshotDir; }
    public void setScreenshotDir(String screenshotDir) { this.screenshotDir = screenshotDir; }
    public String getScreenshotFormat() { return screenshotFormat; }
    public void setScreenshotFormat(String screenshotFormat) { this.screenshotFormat = screenshotFormat; }
    public int getDefaultTimeout() { return defaultTimeout; }
    public void setDefaultTimeout(int defaultTimeout) { this.defaultTimeout = defaultTimeout; }
    public int getDefaultWait() { return defaultWait; }
    public void setDefaultWait(int defaultWait) { this.defaultWait = defaultWait; }
    public int getMaxSessions() { return maxSessions; }
    public void setMaxSessions(int maxSessions) { this.maxSessions = maxSessions; }
    public int getCleanupHours() { return cleanupHours; }
    public void setCleanupHours(int cleanupHours) { this.cleanupHours = cleanupHours; }
}
