package com.autotest.auth;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.autotest.exception.BusinessException;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedCondition;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 浏览器自动化登录服务（基于 Selenium WebDriver）。
 *
 * 用于处理复杂登录场景：
 * - 有验证码的登录
 * - 有前端加密的登录
 * - 多步 SSO 跳转
 * - 需要浏览器交互的登录
 *
 * loginConfig JSON 结构：
 * {
 *   "loginUrl": "https://sso.example.com/login",
 *   "usernameSelector": "#username",
 *   "passwordSelector": "#password",
 *   "captchaSelector": "#captcha-img",
 *   "captchaInputSelector": "#captcha-input",
 *   "submitSelector": "#login-btn",
 *   "successSelector": ".user-info",
 *   "successUrl": "/dashboard",
 *   "tokenExtractors": [
 *     {"type": "localStorage", "key": "access_token"},
 *     {"type": "cookie", "name": "SESSION"},
 *     {"type": "element", "selector": "#token-display", "attribute": "data-token"}
 *   ],
 *   "waitTimeout": 10,
 *   "preActions": [
 *     {"type": "click", "selector": "#agree-checkbox"},
 *     {"type": "wait", "selector": "#captcha-img", "timeout": 5}
 *   ],
 *   "postActions": [
 *     {"type": "click", "selector": ".enter-system"}
 *   ]
 * }
 */
@Service
public class BrowserLoginService {

    private static final Logger log = LoggerFactory.getLogger(BrowserLoginService.class);

    @Autowired
    private CookieSessionManager cookieSessionManager;

    /**
     * 通过浏览器执行登录
     *
     * @param loginConfigJson 登录配置 JSON
     * @param username 用户名
     * @param password 密码
     * @return 登录结果（token、cookie 等）
     */
    public Map<String, Object> login(String loginConfigJson, String username, String password) {
        JSONObject config = JSON.parseObject(loginConfigJson);
        if (config == null) {
            throw new BusinessException(400, "登录配置不能为空");
        }

        String loginUrl = config.getString("loginUrl");
        if (loginUrl == null || loginUrl.isEmpty()) {
            throw new BusinessException(400, "登录页面 URL 不能为空");
        }

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-gpu");
        options.addArguments("--window-size=1920,1080");

        ChromeDriver driver = null;
        try {
            driver = new ChromeDriver(options);
            driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));

            Map<String, Object> result = new LinkedHashMap<>();

            // 1. 打开登录页
            log.info("[BrowserLogin] 打开登录页: {}", loginUrl);
            driver.get(loginUrl);

            // 2. 执行前置操作（如勾选同意框）
            executeActions(driver, config.getJSONArray("preActions"));

            // 3. 填写用户名
            String usernameSelector = config.getString("usernameSelector");
            if (usernameSelector != null && !usernameSelector.isEmpty()) {
                WebElement usernameInput = driver.findElement(By.cssSelector(usernameSelector));
                usernameInput.clear();
                usernameInput.sendKeys(username);
                log.info("[BrowserLogin] 填写用户名");
            }

            // 4. 填写密码
            String passwordSelector = config.getString("passwordSelector");
            if (passwordSelector != null && !passwordSelector.isEmpty()) {
                WebElement passwordInput = driver.findElement(By.cssSelector(passwordSelector));
                passwordInput.clear();
                passwordInput.sendKeys(password);
                log.info("[BrowserLogin] 填写密码");
            }

            // 5. 点击登录按钮
            String submitSelector = config.getString("submitSelector");
            if (submitSelector != null && !submitSelector.isEmpty()) {
                WebElement submitBtn = driver.findElement(By.cssSelector(submitSelector));
                submitBtn.click();
                log.info("[BrowserLogin] 点击登录按钮");
            }

            // 6. 等待登录成功
            Integer waitTimeoutObj = config.getInteger("waitTimeout");
            int waitTimeout = waitTimeoutObj != null ? waitTimeoutObj : 10;
            String successSelector = config.getString("successSelector");
            String successUrl = config.getString("successUrl");

            if (successSelector != null && !successSelector.isEmpty()) {
                new WebDriverWait(driver, Duration.ofSeconds(waitTimeout))
                    .until(ExpectedConditions.presenceOfElementLocated(By.cssSelector(successSelector)));
                log.info("[BrowserLogin] 检测到成功标志: {}", successSelector);
            } else if (successUrl != null && !successUrl.isEmpty()) {
                new WebDriverWait(driver, Duration.ofSeconds(waitTimeout))
                    .until((ExpectedCondition<Boolean>) d -> d.getCurrentUrl().contains(successUrl));
                log.info("[BrowserLogin] 跳转到成功页面: {}", successUrl);
            } else {
                // 默认等待 2 秒
                Thread.sleep(2000);
            }

            // 7. 执行后置操作
            executeActions(driver, config.getJSONArray("postActions"));

            // 8. 提取 Token
            JSONArray extractors = config.getJSONArray("tokenExtractors");
            if (extractors != null) {
                for (int i = 0; i < extractors.size(); i++) {
                    JSONObject extractor = extractors.getJSONObject(i);
                    String type = extractor.getString("type");
                    if ("localStorage".equals(type)) {
                        String key = extractor.getString("key");
                        String value = (String) driver.executeScript("return localStorage.getItem('" + key + "');");
                        if (value != null) {
                            result.put("accessToken", value);
                            result.put("tokenType", "Bearer");
                            log.info("[BrowserLogin] 从 localStorage 提取 token: key={}", key);
                        }
                    } else if ("sessionStorage".equals(type)) {
                        String key = extractor.getString("key");
                        String value = (String) driver.executeScript("return sessionStorage.getItem('" + key + "');");
                        if (value != null) {
                            result.put("accessToken", value);
                            result.put("tokenType", "Bearer");
                            log.info("[BrowserLogin] 从 sessionStorage 提取 token: key={}", key);
                        }
                    } else if ("cookie".equals(type)) {
                        String name = extractor.getString("name");
                        Cookie cookie = driver.manage().getCookieNamed(name);
                        if (cookie != null) {
                            result.put("accessToken", cookie.getValue());
                            result.put("tokenType", "Cookie");
                            log.info("[BrowserLogin] 从 Cookie 提取 token: name={}", name);
                        }
                    } else if ("element".equals(type)) {
                        String selector = extractor.getString("selector");
                        String attribute = extractor.getString("attribute");
                        try {
                            WebElement elem = driver.findElement(By.cssSelector(selector));
                            String value = attribute != null ? elem.getAttribute(attribute) : elem.getText();
                            if (value != null && !value.isEmpty()) {
                                result.put("accessToken", value);
                                result.put("tokenType", "Bearer");
                                log.info("[BrowserLogin] 从元素提取 token: selector={}", selector);
                            }
                        } catch (org.openqa.selenium.NoSuchElementException e) {
                            log.warn("[BrowserLogin] 元素未找到: {}", selector);
                        }
                    }
                }
            }

            // 9. 提取所有 Cookie 并存储到 CookieSessionManager
            String domain = extractDomain(loginUrl);
            Set<Cookie> seleniumCookies = driver.manage().getCookies();
            Map<String, String> cookies = new LinkedHashMap<>();
            for (Cookie cookie : seleniumCookies) {
                cookies.put(cookie.getName(), cookie.getValue());
            }
            if (!cookies.isEmpty()) {
                cookieSessionManager.storeCookies(domain, cookies);
                result.put("cookies", cookies);
                result.put("cookieHeader", buildCookieHeader(cookies));
                log.info("[BrowserLogin] 存储 Cookie: domain={}, count={}", domain, cookies.size());
            }

            // 10. 提取当前 URL（可能包含 token）
            result.put("finalUrl", driver.getCurrentUrl());

            return result;

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[BrowserLogin] 登录失败", e);
            throw new BusinessException(500, "浏览器登录失败: " + e.getMessage());
        } finally {
            if (driver != null) {
                try {
                    driver.quit();
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * 执行预定义的操作序列
     */
    private void executeActions(ChromeDriver driver, JSONArray actions) {
        if (actions == null) return;
        for (int i = 0; i < actions.size(); i++) {
            JSONObject action = actions.getJSONObject(i);
            String type = action.getString("type");
            String selector = action.getString("selector");
            try {
                if ("click".equals(type) && selector != null) {
                    WebElement elem = driver.findElement(By.cssSelector(selector));
                    elem.click();
                    log.debug("[BrowserLogin] 点击: {}", selector);
                } else if ("wait".equals(type) && selector != null) {
                    Integer timeoutObj = action.getInteger("timeout");
                    int timeout = timeoutObj != null ? timeoutObj : 5;
                    new WebDriverWait(driver, Duration.ofSeconds(timeout))
                        .until(ExpectedConditions.presenceOfElementLocated(By.cssSelector(selector)));
                    log.debug("[BrowserLogin] 等待元素: {}", selector);
                } else if ("input".equals(type) && selector != null) {
                    String value = action.getString("value");
                    WebElement elem = driver.findElement(By.cssSelector(selector));
                    elem.clear();
                    elem.sendKeys(value != null ? value : "");
                    log.debug("[BrowserLogin] 输入: {} = {}", selector, value);
                } else if ("js".equals(type)) {
                    String script = action.getString("script");
                    if (script != null) {
                        driver.executeScript(script);
                        log.debug("[BrowserLogin] 执行 JS");
                    }
                }
            } catch (Exception e) {
                log.warn("[BrowserLogin] 操作执行失败: type={}, selector={}", type, selector, e);
            }
        }
    }

    private String extractDomain(String url) {
        try {
            return new java.net.URI(url).getHost();
        } catch (Exception e) {
            return null;
        }
    }

    private String buildCookieHeader(Map<String, String> cookies) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : cookies.entrySet()) {
            if (sb.length() > 0) sb.append("; ");
            sb.append(entry.getKey()).append("=").append(entry.getValue());
        }
        return sb.toString();
    }
}
