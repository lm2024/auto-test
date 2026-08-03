package com.autotest.controller;

import com.autotest.model.vo.Result;
import com.autotest.service.CaptchaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 图形验证码接口。
 * GET /api/captcha -> { token, image(dataURL), expireSeconds }
 */
@RestController
@RequestMapping("/api/captcha")
public class CaptchaController {

    @Autowired
    private CaptchaService captchaService;

    @GetMapping
    public Result<?> getCaptcha() {
        Map<String, Object> data = captchaService.generate();
        return Result.success(data);
    }
}
