package com.autotest.util;

import com.autotest.model.dto.ReplayNodeDTO;

import java.security.MessageDigest;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public class ChainFingerprintUtil {

    private ChainFingerprintUtil() {}

    public static String generate(List<ReplayNodeDTO> nodes) {
        String raw = nodes.stream()
                .sorted(Comparator.comparingInt(n -> n.getSort() != null ? n.getSort() : 0))
                .map(node -> {
                    String method = node.getRequestMethod() != null ? node.getRequestMethod().toUpperCase() : "";
                    String urlPath = extractUrlPath(node.getRequestUrl());
                    return method + "|" + urlPath;
                })
                .collect(Collectors.joining("|"));
        return md5Hex(raw);
    }

    public static String generateFromUrls(List<String> methodAndUrls) {
        String raw = methodAndUrls.stream().collect(Collectors.joining("|"));
        return md5Hex(raw);
    }

    public static String extractUrlPath(String url) {
        if (url == null) return "";
        int queryIndex = url.indexOf('?');
        return queryIndex > 0 ? url.substring(0, queryIndex) : url;
    }

    private static String md5Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("MD5计算失败", e);
        }
    }
}
