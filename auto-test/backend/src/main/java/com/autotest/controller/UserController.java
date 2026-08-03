package com.autotest.controller;

import com.autotest.model.vo.Result;
import com.autotest.model.vo.UserVO;
import com.autotest.service.CaptchaService;
import com.autotest.service.UserService;
import com.autotest.util.PasswordValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private CaptchaService captchaService;

    @PostMapping("/create")
    public Result<?> createUser(@RequestBody Map<String, Object> params) {
        String username = (String) params.get("username");
        String password = (String) params.get("password");
        String displayName = (String) params.get("displayName");
        String role = (String) params.get("role");
        Long tenantId = params.get("tenantId") != null ? Long.valueOf(params.get("tenantId").toString()) : null;
        UserVO vo = userService.createUser(username, password, displayName, role, tenantId);
        return Result.success(vo);
    }

    @PutMapping("/update")
    public Result<?> updateUser(@RequestParam Long id, @RequestBody Map<String, Object> params) {
        String displayName = (String) params.get("displayName");
        String password = (String) params.get("password");
        String role = (String) params.get("role");
        Integer status = params.get("status") != null ? Integer.valueOf(params.get("status").toString()) : null;
        UserVO vo = userService.updateUser(id, displayName, password, role, status);
        return Result.success(vo);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteUser(@RequestParam Long id) {
        userService.deleteUser(id);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<?> listUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        Map<String, Object> data = userService.listUsers(keyword, tenantId, pageNo, pageSize);
        return Result.success(data);
    }

    @GetMapping("/detail")
    public Result<?> getUserDetail(@RequestParam Long id) {
        UserVO vo = userService.getUserById(id);
        return Result.success(vo);
    }

    @PostMapping("/login")
    public Result<?> login(@RequestBody Map<String, String> params) {
        String username = params.get("username");
        String password = params.get("password");
        String captcha = params.get("captcha");
        String captchaToken = params.get("captchaToken");
        if (!captchaService.validate(captchaToken, captcha)) {
            return Result.error(400, "验证码错误或已过期，请重新输入");
        }
        Map<String, Object> result = userService.login(username, password);
        return Result.success(result);
    }
    
    @PostMapping("/validate-password")
    public Result<?> validatePassword(@RequestBody Map<String, String> params) {
        String password = params.get("password");
        PasswordValidator.PasswordStrengthResult result = PasswordValidator.validatePassword(password);
        return Result.success(result);
    }
}
