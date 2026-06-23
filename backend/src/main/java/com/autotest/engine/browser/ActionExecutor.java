package com.autotest.engine.browser;

import com.autotest.model.dto.BrowserAction;
import com.autotest.model.vo.BrowserStepLogVO;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.file.Paths;
import java.util.Base64;

@Component
public class ActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(ActionExecutor.class);

    public BrowserStepLogVO execute(BrowserAction action, Page page, String screenshotDir) {
        BrowserStepLogVO result = new BrowserStepLogVO();
        result.setStepIndex(action.getStepIndex());
        result.setActionType(action.getActionType());
        result.setDescription(action.getDescription());
        long startTime = System.currentTimeMillis();

        try {
            // 执行前等待
            int waitDelay = action.getWaitDelayMs() != null ? action.getWaitDelayMs() : 500;
            if (waitDelay > 0) {
                Thread.sleep(waitDelay);
            }

            double timeout = action.getTimeoutMs() != null ? action.getTimeoutMs().doubleValue() : 30000.0;

            switch (action.getActionType()) {
                case "navigate":
                    page.navigate(action.getTargetUrl(), new Page.NavigateOptions()
                            .setTimeout(timeout));
                    page.waitForLoadState(LoadState.NETWORKIDLE);
                    break;

                case "click":
                    page.locator(action.getTargetSelector())
                            .scrollIntoViewIfNeeded();
                    page.locator(action.getTargetSelector())
                            .click(new Locator.ClickOptions().setTimeout(timeout));
                    break;

                case "input":
                    page.locator(action.getTargetSelector())
                            .scrollIntoViewIfNeeded();
                    page.locator(action.getTargetSelector())
                            .fill(action.getValue(), new Locator.FillOptions().setTimeout(timeout));
                    break;

                case "select":
                    page.locator(action.getTargetSelector())
                            .scrollIntoViewIfNeeded();
                    page.locator(action.getTargetSelector())
                            .selectOption(action.getValue());
                    break;

                case "check":
                    page.locator(action.getTargetSelector())
                            .scrollIntoViewIfNeeded();
                    page.locator(action.getTargetSelector())
                            .setChecked(Boolean.parseBoolean(action.getValue()));
                    break;

                case "submit":
                    page.locator(action.getTargetSelector())
                            .press("Enter");
                    break;

                case "keypress":
                    page.locator(action.getTargetSelector())
                            .press(action.getValue() != null ? action.getValue() : "Enter");
                    break;

                case "wait":
                    int waitMs = action.getWaitDelayMs() != null ? action.getWaitDelayMs() : 1000;
                    page.waitForTimeout(waitMs);
                    break;

                case "screenshot":
                    // screenshot 操作不单独记录，由执行框架统一截图
                    break;

                case "assert":
                    result = executeAssert(action, page, result);
                    break;

                case "evaluate":
                    Object evalResult = page.evaluate(action.getValue());
                    result.setDescription(action.getDescription() + " => " + (evalResult != null ? evalResult.toString() : "null"));
                    break;

                default:
                    log.warn("Unknown action type: {}", action.getActionType());
            }

            result.setStatus("SUCCESS");
        } catch (Exception e) {
            log.error("Action failed: {} {} - {}", action.getStepIndex(), action.getActionType(), e.getMessage());
            result.setStatus("FAILED");
            result.setErrorMessage(e.getMessage());
        }

        result.setCostMs(System.currentTimeMillis() - startTime);
        result.setPageUrl(page.url());
        result.setPageTitle(page.title());
        return result;
    }

    private BrowserStepLogVO executeAssert(BrowserAction action, Page page, BrowserStepLogVO result) {
        String assertType = action.getAssertType();
        String assertValue = action.getAssertValue();
        boolean passed = false;

        try {
            switch (assertType) {
                case "visible":
                    passed = page.locator(assertValue).isVisible();
                    break;
                case "notVisible":
                    passed = page.locator(assertValue).isHidden();
                    break;
                case "exists":
                    passed = page.locator(assertValue).count() > 0;
                    break;
                case "notExists":
                    passed = page.locator(assertValue).count() == 0;
                    break;
                case "text":
                    passed = page.locator("body").textContent().contains(assertValue);
                    break;
                case "urlContains":
                    passed = page.url().contains(assertValue);
                    break;
                case "title":
                    passed = page.title().equals(assertValue);
                    break;
                default:
                    log.warn("Unknown assert type: {}", assertType);
                    passed = false;
            }
        } catch (Exception e) {
            result.setErrorMessage("Assert error: " + e.getMessage());
            result.setStatus("FAILED");
            return result;
        }

        if (!passed) {
            result.setStatus("FAILED");
            result.setErrorMessage("Assert failed: " + assertType + " '" + assertValue + "'");
        } else {
            result.setStatus("SUCCESS");
        }
        return result;
    }

    public String takeScreenshot(Page page, String screenshotDir, String stepLabel) {
        try {
            String fileName = stepLabel.replaceAll("[^a-zA-Z0-9._-]", "_") + ".png";
            String filePath = screenshotDir + "/" + fileName;
            page.screenshot(new Page.ScreenshotOptions()
                    .setFullPage(true)
                    .setPath(Paths.get(filePath)));
            return filePath;
        } catch (Exception e) {
            log.error("Screenshot failed: {}", e.getMessage());
            return null;
        }
    }

    public String takeScreenshotBase64(Page page) {
        try {
            byte[] screenshotBytes = page.screenshot(new Page.ScreenshotOptions()
                    .setFullPage(true));
            return Base64.getEncoder().encodeToString(screenshotBytes);
        } catch (Exception e) {
            log.error("Screenshot base64 failed: {}", e.getMessage());
            return null;
        }
    }
}
