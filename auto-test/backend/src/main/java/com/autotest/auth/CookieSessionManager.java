package com.autotest.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cookie 会话管理器。
 * 管理从登录响应中提取的 Cookie，在后续请求中自动注入。
 */
@Component
public class CookieSessionManager {

    private static final Logger log = LoggerFactory.getLogger(CookieSessionManager.class);

    /**
     * 存储域名→cookie列表的映射
     * Key: domain (如 "example.com")
     * Value: Map<cookieName, cookieValue>
     */
    private final ConcurrentHashMap<String, Map<String, String>> cookieStore = new ConcurrentHashMap<>();

    /**
     * 存储域名→cookie过期时间的映射
     */
    private final ConcurrentHashMap<String, Map<String, Long>> expiryStore = new ConcurrentHashMap<>();

    /**
     * 从登录响应中提取并存储 Cookie
     *
     * @param domain 域名
     * @param cookies 从 Set-Cookie 提取的 cookie 键值对
     */
    public void storeCookies(String domain, Map<String, String> cookies) {
        if (domain == null || cookies == null || cookies.isEmpty()) {
            return;
        }
        String normalizedDomain = normalizeDomain(domain);
        cookieStore.put(normalizedDomain, new ConcurrentHashMap<>(cookies));
        log.info("[CookieSession] 存储 Cookie: domain={}, count={}", normalizedDomain, cookies.size());
    }

    /**
     * 为请求注入 Cookie 头
     *
     * @param requestUrl 请求 URL（用于提取域名）
     * @return Cookie 头字符串（如 "SESSION=abc; JSESSIONID=xyz"），如果没有则返回 null
     */
    public String injectCookies(String requestUrl) {
        String domain = extractDomain(requestUrl);
        if (domain == null) {
            return null;
        }
        String normalizedDomain = normalizeDomain(domain);
        Map<String, String> cookies = cookieStore.get(normalizedDomain);
        if (cookies == null || cookies.isEmpty()) {
            return null;
        }
        return buildCookieHeader(cookies);
    }

    /**
     * 检查指定域名的 Cookie 是否存在
     */
    public boolean hasCookies(String domain) {
        if (domain == null) return false;
        Map<String, String> cookies = cookieStore.get(normalizeDomain(domain));
        return cookies != null && !cookies.isEmpty();
    }

    /**
     * 清除指定域名的 Cookie
     */
    public void clearCookies(String domain) {
        if (domain != null) {
            cookieStore.remove(normalizeDomain(domain));
            expiryStore.remove(normalizeDomain(domain));
        }
    }

    /**
     * 清除所有 Cookie
     */
    public void clearAll() {
        cookieStore.clear();
        expiryStore.clear();
    }

    /**
     * 获取指定域名的所有 Cookie
     */
    public Map<String, String> getCookies(String domain) {
        if (domain == null) return Collections.emptyMap();
        Map<String, String> cookies = cookieStore.get(normalizeDomain(domain));
        return cookies != null ? Collections.unmodifiableMap(cookies) : Collections.emptyMap();
    }

    private String normalizeDomain(String domain) {
        if (domain == null) return "";
        // 去掉协议前缀
        String d = domain.toLowerCase();
        if (d.startsWith("http://")) d = d.substring(7);
        if (d.startsWith("https://")) d = d.substring(8);
        // 去掉路径
        int slashIdx = d.indexOf('/');
        if (slashIdx > 0) d = d.substring(0, slashIdx);
        // 去掉端口
        int colonIdx = d.indexOf(':');
        if (colonIdx > 0) d = d.substring(0, colonIdx);
        return d;
    }

    private String extractDomain(String url) {
        if (url == null) return null;
        try {
            java.net.URI uri = new java.net.URI(url);
            return uri.getHost();
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
