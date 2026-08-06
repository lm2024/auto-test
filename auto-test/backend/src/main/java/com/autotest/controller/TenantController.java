package com.autotest.controller;

import com.autotest.model.entity.SysTenant;
import com.autotest.model.vo.Result;
import com.autotest.service.TenantService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 租户管理 Controller
 * 路由前缀：/api/tenant
 */
@RestController
@RequestMapping("/api/tenant")
public class TenantController {

    @Autowired
    private TenantService tenantService;

    @PostMapping("/create")
    public Result<?> createTenant(@RequestBody SysTenant tenant) {
        SysTenant created = tenantService.createTenant(tenant);
        return Result.success(created);
    }

    @PutMapping("/update")
    public Result<?> updateTenant(@RequestBody SysTenant tenant) {
        SysTenant updated = tenantService.updateTenant(tenant);
        return Result.success(updated);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteTenant(@RequestParam Long id) {
        tenantService.deleteTenant(id);
        return Result.success();
    }

    @GetMapping("/detail")
    public Result<?> getTenant(@RequestParam Long id) {
        SysTenant tenant = tenantService.getTenantById(id);
        return Result.success(tenant);
    }

    @GetMapping("/list")
    public Result<?> listTenants(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        Map<String, Object> data = tenantService.listTenants(keyword, status, pageNo, pageSize);
        return Result.success(data);
    }
}
