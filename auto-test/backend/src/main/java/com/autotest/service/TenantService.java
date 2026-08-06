package com.autotest.service;

import com.autotest.model.entity.SysTenant;

import java.util.List;
import java.util.Map;

public interface TenantService {
    SysTenant createTenant(SysTenant tenant);
    SysTenant updateTenant(SysTenant tenant);
    void deleteTenant(Long id);
    SysTenant getTenantById(Long id);
    SysTenant getTenantByCode(String tenantCode);
    Map<String, Object> listTenants(String keyword, Integer status, int page, int pageSize);
}
