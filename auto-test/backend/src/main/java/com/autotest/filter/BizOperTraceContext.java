package com.autotest.filter;

/**
 * ThreadLocal 工具类，存储当前请求的 BizOperTraceId
 * 用于在整个请求链路中透传操作级 TraceId
 */
public class BizOperTraceContext {

    private static final ThreadLocal<String> TRACE_ID_HOLDER = new ThreadLocal<>();

    /**
     * 设置 TraceId
     */
    public static void setTraceId(String traceId) {
        TRACE_ID_HOLDER.set(traceId);
    }

    /**
     * 获取 TraceId
     */
    public static String getTraceId() {
        return TRACE_ID_HOLDER.get();
    }

    /**
     * 清理 ThreadLocal，防止内存泄漏
     */
    public static void clear() {
        TRACE_ID_HOLDER.remove();
    }
}