package com.autotest.controller;

import com.autotest.auth.BrowserLoginService;
import com.autotest.model.dto.AccountCreateDTO;
import com.autotest.model.entity.TestAccount;
import com.autotest.model.vo.Result;
import com.autotest.service.AccountService;
import com.autotest.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 测试账号管理 Controller
 * 路由前缀：/api/account
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    @Autowired
    private AccountService accountService;

    @Autowired
    private AuthService authService;

    @Autowired
    private BrowserLoginService browserLoginService;

    @PostMapping("/create")
    public Result<?> createAccount(@RequestBody AccountCreateDTO dto) {
        TestAccount account = accountService.createAccount(dto);
        return Result.success(account);
    }

    @PutMapping("/update")
    public Result<?> updateAccount(@RequestParam Long id, @RequestBody AccountCreateDTO dto) {
        TestAccount account = accountService.updateAccount(id, dto);
        return Result.success(account);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteAccount(@RequestParam Long id) {
        accountService.deleteAccount(id);
        return Result.success();
    }

    @GetMapping("/detail")
    public Result<?> getAccount(@RequestParam Long id) {
        TestAccount account = accountService.getAccount(id);
        return Result.success(account);
    }

    @GetMapping("/list")
    public Result<?> listAccounts(
            @RequestParam(required = false) String systemName,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        int offset = (pageNo - 1) * pageSize;
        List<TestAccount> accounts = accountService.listAccounts(systemName, status, offset, pageSize);
        int total = accountService.countAccounts(systemName, status);
        Map<String, Object> data = new HashMap<>();
        data.put("list", accounts);
        data.put("total", total);
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return Result.success(data);
    }

    @PostMapping("/acquire")
    public Result<?> acquireAccount(@RequestParam String accountCode) {
        TestAccount account = accountService.acquireAccount(accountCode);
        return Result.success(account);
    }

    @PostMapping("/release")
    public Result<?> releaseAccount(@RequestParam String accountCode) {
        accountService.releaseAccount(accountCode);
        return Result.success();
    }

    /**
     * 登录测试：验证登录配置是否正确
     */
    @PostMapping("/login-test")
    public Result<?> loginTest(@RequestBody Map<String, String> params) {
        String loginType = params.get("loginType");
        String loginConfig = params.get("loginConfig");
        String username = params.get("username");
        String password = params.get("password");

        if (loginType == null || loginConfig == null || username == null || password == null) {
            return Result.error("参数不完整");
        }

        Map<String, Object> result = new HashMap<>();
        try {
            if ("PLAYWRIGHT".equals(loginType)) {
                // 浏览器自动化登录
                Map<String, Object> loginResult = browserLoginService.login(loginConfig, username, password);
                result.putAll(loginResult);
                result.put("success", true);
            } else {
                // HTTP 方式登录（PASSWORD/COOKIE/OAUTH2_CODE/CAS）
                // 创建临时账号进行测试
                com.autotest.model.entity.TestAccount tempAccount = new com.autotest.model.entity.TestAccount();
                tempAccount.setUsername(username);
                tempAccount.setPassword(password);
                tempAccount.setAuthType(loginType);
                tempAccount.setAuthConfig(loginConfig);

                // 使用 AuthService 获取 token
                // 由于 AuthService 需要 accountCode，这里用临时逻辑
                com.alibaba.fastjson.JSONObject config = com.alibaba.fastjson.JSON.parseObject(loginConfig);
                result.put("success", true);
                result.put("message", "配置格式验证通过，请保存后在链路中测试");
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return Result.success(result);
    }
}