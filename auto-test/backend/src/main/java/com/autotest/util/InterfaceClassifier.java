package com.autotest.util;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.autotest.mapper.SysSystemRegistryMapper;
import com.autotest.model.entity.SysSystemRegistry;
import com.autotest.model.vo.ClassifyResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 接口内外网识别器：根据系统注册表的域名通配符与 IP 段，判定 URL 归属的系统与内外网范围。
 * 注册表使用 60 秒 TTL 的内存缓存，注册数据变更时由 SystemRegistryService 主动失效。
 */
@Component
public class InterfaceClassifier {

    private static final Logger log = LoggerFactory.getLogger(InterfaceClassifier.class);

    public static final String SCOPE_INTERNAL = "INTERNAL";
    public static final String SCOPE_EXTERNAL = "EXTERNAL";
    public static final String SCOPE_UNKNOWN = "UNKNOWN";

    private static final long CACHE_TTL_MS = 60000L;
    private static final Pattern SCHEME_PATTERN = Pattern.compile("^[a-zA-Z][a-zA-Z0-9+.\\-]*://.*");
    private static final Pattern IPV4_PATTERN = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$");

    @Autowired
    private SysSystemRegistryMapper registryMapper;

    private volatile List<SysSystemRegistry> cachedRegistries = null;
    private volatile long cacheTimestamp = 0L;

    /**
     * 对 URL 做内外网与归属系统分类，任何异常都不抛出，最差返回 UNKNOWN
     */
    public ClassifyResult classify(String url) {
        String host;
        try {
            host = extractHost(url);
        } catch (Exception e) {
            host = null;
        }
        if (host == null || host.isEmpty()) {
            return new ClassifyResult(SCOPE_UNKNOWN, "", "");
        }

        try {
            List<SysSystemRegistry> registries = getRegistries();
            for (SysSystemRegistry registry : registries) {
                if (matchDomain(host, registry.getDomainPatterns())
                        || matchIpRange(host, registry.getIpRanges())) {
                    String scope = registry.getScope() == null || registry.getScope().trim().isEmpty()
                            ? SCOPE_INTERNAL : registry.getScope().trim().toUpperCase();
                    return new ClassifyResult(scope,
                            registry.getSystemCode() == null ? "" : registry.getSystemCode(),
                            registry.getSystemName() == null ? "" : registry.getSystemName());
                }
            }
        } catch (Exception e) {
            log.warn("[Classifier] 匹配注册表失败: url={}, {}", url, e.getMessage());
        }

        // 未命中注册表：按私有地址/内网域名特征兜底
        if (isPrivateOrInternalHost(host)) {
            return new ClassifyResult(SCOPE_INTERNAL, "", "");
        }
        return new ClassifyResult(SCOPE_EXTERNAL, "", "");
    }

    /**
     * 从 URL 中解析 host，解析不出或含未替换占位符时返回 null
     */
    public String extractHost(String url) {
        if (url == null) {
            return null;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String candidate = SCHEME_PATTERN.matcher(trimmed).matches() ? trimmed : "http://" + trimmed;

        String host = null;
        try {
            URI uri = new URI(candidate);
            host = uri.getHost();
        } catch (Exception ignored) {
            // URI 解析失败时走手工解析
        }
        if (host == null || host.isEmpty()) {
            host = parseHostManually(candidate);
        }
        if (host == null) {
            return null;
        }
        host = host.trim();
        if (host.startsWith("[") && host.endsWith("]")) {
            host = host.substring(1, host.length() - 1);
        }
        if (host.isEmpty() || host.contains("${") || host.contains("{") || host.contains("}")
                || host.contains(" ")) {
            return null;
        }
        return host.toLowerCase();
    }

    /**
     * 获取注册表（带 60 秒 TTL 缓存）
     */
    public List<SysSystemRegistry> getRegistries() {
        List<SysSystemRegistry> local = cachedRegistries;
        long now = System.currentTimeMillis();
        if (local != null && (now - cacheTimestamp) < CACHE_TTL_MS) {
            return local;
        }
        List<SysSystemRegistry> loaded;
        try {
            loaded = registryMapper.selectAll();
        } catch (Exception e) {
            log.warn("[Classifier] 加载系统注册表失败: {}", e.getMessage());
            loaded = null;
        }
        if (loaded == null) {
            loaded = new ArrayList<SysSystemRegistry>();
        }
        List<SysSystemRegistry> immutable = Collections.unmodifiableList(loaded);
        cachedRegistries = immutable;
        cacheTimestamp = now;
        return immutable;
    }

    /**
     * 主动失效缓存，注册表增删改后调用
     */
    public void invalidateCache() {
        cachedRegistries = null;
        cacheTimestamp = 0L;
    }

    /**
     * 域名通配符匹配（大小写不敏感）
     */
    private boolean matchDomain(String host, String patternsJson) {
        List<String> patterns = parseJsonArray(patternsJson);
        for (String pattern : patterns) {
            if (pattern == null || pattern.trim().isEmpty()) {
                continue;
            }
            try {
                Pattern regex = Pattern.compile(wildcardToRegex(pattern.trim()), Pattern.CASE_INSENSITIVE);
                if (regex.matcher(host).matches()) {
                    return true;
                }
            } catch (Exception ignored) {
                // 非法模式跳过
            }
        }
        return false;
    }

    /**
     * IP 段匹配，支持 CIDR 与单个 IP，仅当 host 为 IPv4 字面量时生效
     */
    private boolean matchIpRange(String host, String rangesJson) {
        if (!isIpv4(host)) {
            return false;
        }
        Long hostIp = ipToLong(host);
        if (hostIp == null) {
            return false;
        }
        List<String> ranges = parseJsonArray(rangesJson);
        for (String range : ranges) {
            if (range == null || range.trim().isEmpty()) {
                continue;
            }
            if (inCidr(hostIp.longValue(), range.trim())) {
                return true;
            }
        }
        return false;
    }

    /**
     * 解析 JSON 数组字符串；非 JSON 时按逗号切分兜底
     */
    private List<String> parseJsonArray(String text) {
        List<String> result = new ArrayList<String>();
        if (text == null || text.trim().isEmpty()) {
            return result;
        }
        String trimmed = text.trim();
        if (trimmed.startsWith("[")) {
            try {
                JSONArray array = JSON.parseArray(trimmed);
                for (int i = 0; i < array.size(); i++) {
                    Object item = array.get(i);
                    if (item != null) {
                        result.add(String.valueOf(item));
                    }
                }
                return result;
            } catch (Exception e) {
                log.warn("[Classifier] JSON数组解析失败: {}", trimmed);
                return result;
            }
        }
        for (String part : trimmed.split(",")) {
            if (!part.trim().isEmpty()) {
                result.add(part.trim());
            }
        }
        return result;
    }

    /**
     * 通配符转正则，* 匹配任意字符，其余字符原样转义
     */
    private static String wildcardToRegex(String wildcard) {
        StringBuilder sb = new StringBuilder();
        StringBuilder literal = new StringBuilder();
        for (int i = 0; i < wildcard.length(); i++) {
            char c = wildcard.charAt(i);
            if (c == '*') {
                if (literal.length() > 0) {
                    sb.append(Pattern.quote(literal.toString()));
                    literal.setLength(0);
                }
                sb.append(".*");
            } else {
                literal.append(c);
            }
        }
        if (literal.length() > 0) {
            sb.append(Pattern.quote(literal.toString()));
        }
        return sb.toString();
    }

    /**
     * 是否 IPv4 字面量
     */
    public static boolean isIpv4(String host) {
        return ipToLong(host) != null;
    }

    /**
     * IPv4 转 long，非法返回 null
     */
    private static Long ipToLong(String ip) {
        if (ip == null) {
            return null;
        }
        java.util.regex.Matcher matcher = IPV4_PATTERN.matcher(ip.trim());
        if (!matcher.matches()) {
            return null;
        }
        long value = 0L;
        for (int i = 1; i <= 4; i++) {
            int segment;
            try {
                segment = Integer.parseInt(matcher.group(i));
            } catch (NumberFormatException e) {
                return null;
            }
            if (segment < 0 || segment > 255) {
                return null;
            }
            value = (value << 8) | segment;
        }
        return Long.valueOf(value);
    }

    /**
     * 判断 IP 是否落在 CIDR 段内（纯 long 位运算），range 也可以是单个 IP
     */
    private static boolean inCidr(long hostIp, String range) {
        int slashIndex = range.indexOf('/');
        if (slashIndex < 0) {
            Long single = ipToLong(range);
            return single != null && single.longValue() == hostIp;
        }
        Long networkIp = ipToLong(range.substring(0, slashIndex));
        if (networkIp == null) {
            return false;
        }
        int prefix;
        try {
            prefix = Integer.parseInt(range.substring(slashIndex + 1).trim());
        } catch (NumberFormatException e) {
            return false;
        }
        if (prefix < 0 || prefix > 32) {
            return false;
        }
        long mask = prefix == 0 ? 0L : ((0xFFFFFFFFL << (32 - prefix)) & 0xFFFFFFFFL);
        return (hostIp & mask) == (networkIp.longValue() & mask);
    }

    /**
     * RFC1918 私有地址 / 内网域名后缀 / 无点主机名 判定
     */
    private static boolean isPrivateOrInternalHost(String host) {
        String lower = host.toLowerCase();
        if (lower.endsWith(".local") || lower.endsWith(".internal")) {
            return true;
        }
        Long ip = ipToLong(lower);
        if (ip != null) {
            long value = ip.longValue();
            long first = (value >> 24) & 0xFF;
            long second = (value >> 16) & 0xFF;
            if (first == 10L || first == 127L) {
                return true;
            }
            if (first == 172L && second >= 16L && second <= 31L) {
                return true;
            }
            return first == 192L && second == 168L;
        }
        // 不含点的主机名（localhost、myservice 等）视为内网
        return !lower.contains(".");
    }

    /**
     * 手工解析 host：去协议、去 userinfo、截断路径与端口
     */
    private String parseHostManually(String candidate) {
        String rest = candidate;
        int schemeIndex = rest.indexOf("://");
        if (schemeIndex >= 0) {
            rest = rest.substring(schemeIndex + 3);
        }
        int cut = rest.length();
        for (int i = 0; i < rest.length(); i++) {
            char c = rest.charAt(i);
            if (c == '/' || c == '?' || c == '#') {
                cut = i;
                break;
            }
        }
        rest = rest.substring(0, cut);
        int at = rest.lastIndexOf('@');
        if (at >= 0) {
            rest = rest.substring(at + 1);
        }
        int colon = rest.lastIndexOf(':');
        if (colon >= 0 && rest.indexOf(':') == colon) {
            rest = rest.substring(0, colon);
        }
        return rest;
    }
}
