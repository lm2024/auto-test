package com.autotest.controller;

import com.autotest.model.vo.Result;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/sso")
public class SsoController {

    @Value("${sso.enabled:false}")
    private boolean ssoEnabled;

    @Value("${sso.authorize-url:}")
    private String authorizeUrl;

    @Value("${sso.client-id:}")
    private String clientId;

    @Value("${sso.redirect-uri:}")
    private String redirectUri;

    @GetMapping("/providers")
    public Result<?> getProviders() {
        Map<String, Object> data = new HashMap<>();
        data.put("enabled", ssoEnabled);
        if (ssoEnabled) {
            data.put("name", "SSO");
            data.put("authorizeUrl", authorizeUrl);
        }
        return Result.success(data);
    }

    @GetMapping("/login")
    public Result<?> ssoLogin() {
        if (!ssoEnabled) {
            return Result.error("SSO 未启用");
        }
        String state = java.util.UUID.randomUUID().toString();
        String url = authorizeUrl
                + "?client_id=" + clientId
                + "&redirect_uri=" + redirectUri
                + "&response_type=code"
                + "&state=" + state;
        Map<String, String> data = new HashMap<>();
        data.put("url", url);
        return Result.success(data);
    }

    @GetMapping("/callback")
    public Result<?> ssoCallback(@RequestParam String code, @RequestParam(required = false) String state) {
        // TODO: Exchange code for token, get user info, create/find local user, issue JWT
        // This is a placeholder for the actual SSO integration
        return Result.success("SSO callback received, code: " + code);
    }
}
