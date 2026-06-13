package com.autotest.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class JsonPathUtil {

    private JsonPathUtil() {}

    public static Map<String, String> extractLeafPaths(Object json, String prefix) {
        Map<String, String> paths = new LinkedHashMap<>();
        doExtract(json, prefix, paths);
        return paths;
    }

    private static void doExtract(Object obj, String prefix, Map<String, String> paths) {
        if (obj instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) obj;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String childPath = prefix + "." + entry.getKey();
                doExtract(entry.getValue(), childPath, paths);
            }
        } else if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            for (int i = 0; i < list.size(); i++) {
                doExtract(list.get(i), prefix + "[" + i + "]", paths);
            }
        } else {
            paths.put(prefix, String.valueOf(obj));
        }
    }

    public static Map<String, String> extractRequestBodyPaths(String bodyJson) {
        if (bodyJson == null || bodyJson.isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            Object obj = com.alibaba.fastjson.JSON.parse(bodyJson);
            Map<String, String> paths = new LinkedHashMap<>();
            doExtract(obj, "$", paths);
            return paths;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    public static Map<String, String> extractResponseLeafPaths(String responseJson) {
        if (responseJson == null || responseJson.isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            Object obj = com.alibaba.fastjson.JSON.parse(responseJson);
            Map<String, String> paths = new LinkedHashMap<>();
            doExtract(obj, "$", paths);
            return paths;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    public static String normalizeFieldName(String fieldName) {
        if (fieldName == null || fieldName.isEmpty()) {
            return "";
        }
        // Remove $. prefix
        String name = fieldName;
        if (name.startsWith("$.")) {
            name = name.substring(2);
        }
        // Remove array indices like [0]
        name = name.replaceAll("\\[\\d+\\]", "");
        return name.toLowerCase().replace("_", "");
    }
}
