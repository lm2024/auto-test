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
    private Browser browser;
    private final ConcurrentHashMap<String, BrowserContext> sessions = new ConcurrentHashMap<>();
    private final AtomicInteger sessionCounter = new AtomicInteger(0);
    private boolean initialized = false;

    public synchronized void ensureInitialized() {
        if (initialized) return;
        playwright = Playwright.create();
        BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
                .setHeadless(browserConfig.isHeadless())
                .setTimeout(browserConfig.getDefaultTimeout());
        switch (browserConfig.getBrowserType().toLowerCase()) {
            case "firefox":
                browser = playwright.firefox().launch(launchOptions);
                break;
            case "webkit":
                browser = playwright.webkit().launch(launchOptions);
                break;
            default:
                browser = playwright.chromium().launch(launchOptions);
        }
        initialized = true;
        log.info("Browser initialized: type={}, headless={}", browserConfig.getBrowserType(), browserConfig.isHeadless());
    }

    public String createSession() {
        ensureInitialized();
        Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                .setViewportSize(1280, 720);
        BrowserContext context = browser.newContext(contextOptions);
        String sessionId = "session_" + sessionCounter.incrementAndGet();
        sessions.put(sessionId, context);
        log.info("Browser session created: {}", sessionId);
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
        if (browser != null) browser.close();
        if (playwright != null) playwright.close();
        log.info("Playwright shut down");
    }
}
