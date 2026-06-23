package com.autotest.service;

import com.autotest.model.dto.BrowserAction;
import com.autotest.model.vo.BrowserStepLogVO;

import java.util.List;

public interface BrowserAutomationService {
    String createSession(boolean headless);
    void closeSession(String sessionId);
    BrowserStepLogVO executeAction(String sessionId, BrowserAction action);
    List<BrowserStepLogVO> executeScript(String sessionId, List<BrowserAction> actions, String screenshotDir);
    String takeScreenshot(String sessionId, String stepLabel);
    int getActiveSessionCount();
}
