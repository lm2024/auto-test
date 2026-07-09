package com.autotest.service;

import java.util.Map;

public interface SsoService {
    Map<String, Object> exchangeCodeForToken(String code);
    Map<String, Object> getUserInfo(String accessToken);
    String handleSsoLogin(String provider, String subject, String displayName);
}
