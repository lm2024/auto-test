package com.autotest.util;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PlaceholderUtil {

    private static final Pattern PATTERN = Pattern.compile("\\$\\{(\\w+)}");

    private PlaceholderUtil() {}

    public static String replace(String template, Map<String, Object> variables) {
        if (template == null || template.isEmpty()) {
            return template;
        }
        StringBuffer sb = new StringBuffer();
        Matcher matcher = PATTERN.matcher(template);
        while (matcher.find()) {
            String varName = matcher.group(1);
            Object value = variables.get(varName);
            if (value != null) {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(String.valueOf(value)));
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    public static boolean hasPlaceholder(String text) {
        if (text == null) return false;
        return PATTERN.matcher(text).find();
    }
}
