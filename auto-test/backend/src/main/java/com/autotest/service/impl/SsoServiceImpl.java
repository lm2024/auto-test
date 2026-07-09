package com.autotest.service.impl;

import com.autotest.mapper.SysUserMapper;
import com.autotest.mapper.SysUserSsoMapper;
import com.autotest.model.entity.SysUser;
import com.autotest.model.entity.SysUserSso;
import com.autotest.service.SsoService;
import com.autotest.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class SsoServiceImpl implements SsoService {

    @Autowired
    private SysUserMapper userMapper;

    @Autowired
    private SysUserSsoMapper ssoMapper;

    @Override
    public Map<String, Object> exchangeCodeForToken(String code) {
        // TODO: Implement OAuth2 code exchange with company SSO
        // This is a placeholder
        Map<String, Object> result = new HashMap<>();
        result.put("access_token", "placeholder_token");
        return result;
    }

    @Override
    public Map<String, Object> getUserInfo(String accessToken) {
        // TODO: Implement user info fetch from company SSO
        // This is a placeholder
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("sub", "sso_user_001");
        userInfo.put("name", "SSO User");
        return userInfo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String handleSsoLogin(String provider, String subject, String displayName) {
        SysUserSso sso = ssoMapper.selectBySubject(provider, subject);
        SysUser user;

        if (sso != null) {
            user = userMapper.selectById(sso.getUserId());
        } else {
            // Create new user from SSO
            String username = "sso_" + subject;
            user = new SysUser();
            user.setUsername(username);
            user.setPassword("$2a$10$placeholder");
            user.setDisplayName(displayName != null ? displayName : username);
            user.setRole("USER");
            user.setStatus(1);
            userMapper.insert(user);

            sso = new SysUserSso();
            sso.setUserId(user.getId());
            sso.setSsoProvider(provider);
            sso.setSsoSubject(subject);
            ssoMapper.insert(sso);
        }

        userMapper.updateLoginTime(user.getId());
        return JwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole(), user.getTenantId());
    }
}
