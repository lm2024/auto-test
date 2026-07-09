package com.autotest.service;

import java.util.Map;

/**
 * 认证服务接口 - Phase 4: SSO认证与Token管理
 */
public interface AuthService {

    /**
     * 根据账号编码获取token
     * @param accountCode 账号编码
     * @return token信息（accessToken, refreshToken, expiresIn等）
     */
    Map<String, Object> getToken(String accountCode);

    /**
     * 刷新token
     * @param accountCode 账号编码
     * @param refreshToken 刷新令牌
     * @return 新的token信息
     */
    Map<String, Object> refreshToken(String accountCode, String refreshToken);

    /**
     * 验证token有效性
     * @param token JWT token
     * @return 有效性及过期时间
     */
    Map<String, Object> validateToken(String token);
}
