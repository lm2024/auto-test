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
        String tempAccountCode = "LOGIN_TEST_" + System.currentTimeMillis();
        try {
            if ("PLAYWRIGHT".equals(loginType)) {
                // 浏览器自动化登录
                Map<String, Object> loginResult = browserLoginService.login(loginConfig, username, password);
                result.putAll(loginResult);
                result.put("success", true);
            } else {
                // 通过临时账号复用正式认证链路，确保向导测试和真实执行行为一致。
                AccountCreateDTO dto = new AccountCreateDTO();
                dto.setAccountCode(tempAccountCode);
                dto.setAccountName("登录向导临时测试账号");
                dto.setUsername(username);
                dto.setPassword(password);
                dto.setAuthType(loginType);
                dto.setLoginType(loginType);
                dto.setAuthConfig(loginConfig);
                dto.setLoginConfig(loginConfig);
                accountService.createAccount(dto);
                Map<String, Object> loginResult = authService.getToken(tempAccountCode);
                result.putAll(loginResult);
                result.put("success", true);
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        } finally {
            if (!"PLAYWRIGHT".equals(loginType)) {
                try {
                    accountService.deleteAccountByCode(tempAccountCode);
                } catch (Exception cleanupException) {
                    // 测试账号清理失败不能覆盖原始登录结果，但必须留痕排查。
                    org.slf4j.LoggerFactory.getLogger(AccountController.class)
                            .warn("[LoginWizard] 清理临时测试账号失败: accountCode={}", tempAccountCode, cleanupException);
                }
            }
        }
        return Result.success(result);
    }
}
