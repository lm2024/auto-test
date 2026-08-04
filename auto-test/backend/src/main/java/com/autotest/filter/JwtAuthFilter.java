package com.autotest.filter;

import com.autotest.util.JwtUtil;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class JwtAuthFilter implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        // 放行预检请求：浏览器跨域（含经 nginx 反代）会先发 OPTIONS 预检，
        // 而 Spring MVC 在 preflight 时仍会执行自定义拦截器链，不带 Authorization 必然 401。
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (JwtUtil.isTokenValid(token)) {
                request.setAttribute("userId", JwtUtil.getUserId(token));
                request.setAttribute("username", JwtUtil.getUsername(token));
                request.setAttribute("role", JwtUtil.getRole(token));
                request.setAttribute("tenantId", JwtUtil.getTenantId(token));
                return true;
            }
            writeUnauthorized(response, "TOKEN_EXPIRED", "登录已过期，请重新登录");
            return false;
        }
        writeUnauthorized(response, "NO_TOKEN", "未登录，请先登录平台");
        return false;
    }

    private void writeUnauthorized(HttpServletResponse response, String reason, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":401,\"message\":\"" + message + "\",\"reason\":\"" + reason + "\"}");
    }
}
