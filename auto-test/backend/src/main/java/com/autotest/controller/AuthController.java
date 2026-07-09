package com.autotest.controller;

import com.autotest.model.vo.Result;
import com.autotest.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Phase 4: 认证控制器 - SSO认证与Token管理
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    /**
     * 根据账号编码获取token
     */
    @PostMapping("/token")
    public Result<?> getToken(@RequestParam String accountCode) {
        Map<String, Object> tokenInfo = authService.getToken(accountCode);
        return Result.success(tokenInfo);
    }

    /**
     * 刷新token
     */
    @PostMapping("/refresh")
    public Result<?> refreshToken(
            @RequestParam String accountCode,
            @RequestParam String refreshToken) {
        Map<String, Object> tokenInfo = authService.refreshToken(accountCode, refreshToken);
        return Result.success(tokenInfo);
    }

    /**
     * 验证token有效性
     */
    @GetMapping("/validate")
    public Result<?> validateToken(@RequestParam String token) {
        Map<String, Object> result = authService.validateToken(token);
        return Result.success(result);
    }
}
