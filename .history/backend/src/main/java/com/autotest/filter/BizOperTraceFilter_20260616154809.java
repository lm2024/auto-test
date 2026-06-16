package com.autotest.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * BizOperTraceId 透传过滤器
 * 从请求头 X-Biz-Oper-Trace 提取操作级 TraceId，存入 ThreadLocal
 * 供后续 Feign/MyBatis 等调用透传使用
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BizOperTraceFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(BizOperTraceFilter.class);
    private static final String TRACE_HEADER = "X-Biz-Oper-Trace";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String traceId = request.getHeader(TRACE_HEADER);
        if (traceId != null && !traceId.isEmpty()) {
            BizOperTraceContext.setTraceId(traceId);
            log.debug("[BizOperTrace] 请求路径: {}, 携带 TraceId: {}", request.getRequestURI(), traceId);
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            // 请求结束后清理 ThreadLocal，防止内存泄漏
            BizOperTraceContext.clear();
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // 仅过滤 /api/** 路径
        return !path.startsWith("/api/");
    }
