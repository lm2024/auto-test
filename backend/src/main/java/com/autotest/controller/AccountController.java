package com.autotest.controller;

import com.autotest.model.dto.AccountCreateDTO;
import com.autotest.model.entity.TestAccount;
import com.autotest.model.vo.Result;
import com.autotest.service.AccountService;
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
}