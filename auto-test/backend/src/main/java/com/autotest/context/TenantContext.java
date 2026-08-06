package com.autotest.context;

/**
 * 租户上下文，基于 ThreadLocal 存储当前请求的租户信息。
 * 在 JwtAuthFilter 中设置，在请求结束后清理。
 */
public class TenantContext {

    private static final ThreadLocal<Long> TENANT_ID = new ThreadLocal<>();

    /**
     * 设置当前请求的租户 ID
     */
    public static void setTenantId(Long tenantId) {
        TENANT_ID.set(tenantId);
    }

    /**
     * 获取当前请求的租户 ID
     */
    public static Long getTenantId() {
        return TENANT_ID.get();
    }

    /**
     * 清理当前线程的租户上下文（防止内存泄漏）
     */
    public static void clear() {
        TENANT_ID.remove();
    }
}
