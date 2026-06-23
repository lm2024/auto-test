package com.autotest.service.impl;

import com.autotest.config.BrowserConfig;
import com.autotest.engine.browser.ActionExecutor;
import com.autotest.engine.browser.BrowserSessionManager;
import com.autotest.model.dto.BrowserAction;
import com.autotest.model.vo.BrowserStepLogVO;
import com.autotest.service.BrowserAutomationService;
import com.microsoft.playwright.Page;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class BrowserAutomationServiceImpl implements BrowserAutomationService {

    private static final Logger log = LoggerFactory.getLogger(BrowserAutomationServiceImpl.class);

    @Autowired
    private BrowserSessionManager sessionManager;

    @Autowired
    private ActionExecutor actionExecutor;

    @Autowired
    private BrowserConfig browserConfig;

    @Override
    public String createSession(boolean headless) {
        return sessionManager.createSession(headless);
    }

    @Override
    public void closeSession(String sessionId) {
        sessionManager.closeSession(sessionId);
    }

    @Override
    public BrowserStepLogVO executeAction(String sessionId, BrowserAction action) {
        Page page = sessionManager.getPage(sessionId);
        if (page == null) {
            BrowserStepLogVO error = new BrowserStepLogVO();
            error.setStatus("FAILED");
            error.setErrorMessage("Session not found: " + sessionId);
            return error;
        }
        BrowserStepLogVO result = actionExecutor.execute(action, page, browserConfig.getScreenshotDir());

        // 如果是截图步骤或者执行完毕后，自动截图
        if ("screenshot".equals(action.getActionType())) {
            String screenshotPath = actionExecutor.takeScreenshot(page,
                    browserConfig.getScreenshotDir(),
                    "step_" + action.getStepIndex());
            result.setScreenshotUrl(screenshotPath);
        } else if ("SUCCESS".equals(result.getStatus())) {
            // 非截图步骤也截图用于记录
            String screenshotPath = actionExecutor.takeScreenshot(page,
                    browserConfig.getScreenshotDir(),
                    "step_" + action.getStepIndex());
            result.setScreenshotUrl(screenshotPath);
        }

        return result;
    }

    @Override
    public List<BrowserStepLogVO> executeScript(String sessionId, List<BrowserAction> actions, String screenshotDir) {
        List<BrowserStepLogVO> results = new ArrayList<>();
        Page page = sessionManager.getPage(sessionId);
        if (page == null) {
            BrowserStepLogVO error = new BrowserStepLogVO();
            error.setStatus("FAILED");
            error.setErrorMessage("Session not found: " + sessionId);
            results.add(error);
            return results;
        }

        for (BrowserAction action : actions) {
            BrowserStepLogVO result = actionExecutor.execute(action, page,
                    screenshotDir != null ? screenshotDir : browserConfig.getScreenshotDir());
            results.add(result);

            // 非截图类型也自动截图
            if (!"screenshot".equals(action.getActionType())) {
                String screenshotPath = actionExecutor.takeScreenshot(page,
                        screenshotDir != null ? screenshotDir : browserConfig.getScreenshotDir(),
                        "step_" + action.getStepIndex());
                result.setScreenshotUrl(screenshotPath);
            }

            // 如果失败且不继续，停止执行
            if ("FAILED".equals(result.getStatus()) && !action.isContinueOnFail()) {
                log.warn("Script execution stopped at step {} due to failure", action.getStepIndex());
                break;
            }
        }

        return results;
    }

    @Override
    public String takeScreenshot(String sessionId, String stepLabel) {
        Page page = sessionManager.getPage(sessionId);
        if (page == null) return null;
        return actionExecutor.takeScreenshot(page, browserConfig.getScreenshotDir(), stepLabel);
    }

    @Override
    public int getActiveSessionCount() {
        return sessionManager.getActiveSessionCount();
    }
}
