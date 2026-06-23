package com.autotest.engine.browser;

import com.autotest.config.BrowserConfig;
import com.microsoft.playwright.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class BrowserSessionManager {

    private static final Logger log = LoggerFactory.getLogger(BrowserSessionManager.class);

    @Autowired
    private BrowserConfig browserConfig;

    private Playwright playwright;
    private Browser headlessBrowser;
    private Browser visibleBrowser;
    private final ConcurrentHashMap<String, BrowserContext> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Boolean> sessionHeadless = new ConcurrentHashMap<>();
    private final AtomicInteger sessionCounter = new AtomicInteger(0);
    private boolean headlessInitialized = false;
    private boolean visibleInitialized = false;

    private synchronized Browser getOrInitBrowser(boolean headless) {
        if (playwright == null) {
            playwright = Playwright.create();
        }
        if (headless) {
            if (!headlessInitialized) {
                BrowserType.LaunchOptions opts = new BrowserType.LaunchOptions()
                        .setHeadless(true)
                        .setTimeout(browserConfig.getDefaultTimeout());
                headlessBrowser = launchBrowser(opts);
                headlessInitialized = true;
                log.info("Headless browser initialized: type={}", browserConfig.getBrowserType());
            }
            return headlessBrowser;
        } else {
            if (!visibleInitialized) {
                BrowserType.LaunchOptions opts = new BrowserType.LaunchOptions()
                        .setHeadless(false)
                        .setTimeout(browserConfig.getDefaultTimeout());
                visibleBrowser = launchBrowser(opts);
                visibleInitialized = true;
                log.info("Visible browser initialized: type={}", browserConfig.getBrowserType());
            }
            return visibleBrowser;
        }
    }

    private Browser launchBrowser(BrowserType.LaunchOptions opts) {
        switch (browserConfig.getBrowserType().toLowerCase()) {
            case "firefox":
                return playwright.firefox().launch(opts);
            case "webkit":
                return playwright.webkit().launch(opts);
            default:
                return playwright.chromium().launch(opts);
        }
    }

    public String createSession() {
        return createSession(browserConfig.isHeadless());
    }

    public String createSession(boolean headless) {
        Browser browser = getOrInitBrowser(headless);
        Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                .setViewportSize(1280, 720);
        BrowserContext context = browser.newContext(contextOptions);
        String sessionId = "session_" + sessionCounter.incrementAndGet();
        sessions.put(sessionId, context);
        sessionHeadless.put(sessionId, headless);
        log.info("Browser session created: {}, headless={}", sessionId, headless);
        return sessionId;
    }

    public Page getPage(String sessionId) {
        BrowserContext context = sessions.get(sessionId);
        if (context == null) return null;
        if (context.pages().isEmpty()) {
            return context.newPage();
        }
        return context.pages().get(0);
    }

    public BrowserContext getContext(String sessionId) {
        return sessions.get(sessionId);
    }

    public void closeSession(String sessionId) {
        BrowserContext context = sessions.remove(sessionId);
        if (context != null) {
            context.close();
            log.info("Browser session closed: {}", sessionId);
        }
    }

    public int getActiveSessionCount() {
        return sessions.size();
    }

    public void closeAllSessions() {
        sessions.values().forEach(BrowserContext::close);
        sessions.clear();
        log.info("All browser sessions closed");
    }

    @PreDestroy
    public void shutdown() {
        closeAllSessions();
        if (headlessBrowser != null) headlessBrowser.close();
        if (visibleBrowser != null) visibleBrowser.close();
        if (playwright != null) playwright.close();
        log.info("Playwright shut down");
    }
}
