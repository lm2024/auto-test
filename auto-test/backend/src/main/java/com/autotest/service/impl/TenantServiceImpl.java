package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysTenantMapper;
import com.autotest.model.entity.SysTenant;
import com.autotest.service.TenantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TenantServiceImpl implements TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantServiceImpl.class);

    @Autowired
    private SysTenantMapper tenantMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysTenant createTenant(SysTenant tenant) {
        if (tenant.getTenantCode() == null || tenant.getTenantCode().trim().isEmpty()) {
            throw new BusinessException(400, "租户编码不能为空");
        }
        if (tenant.getTenantName() == null || tenant.getTenantName().trim().isEmpty()) {
            throw new BusinessException(400, "租户名称不能为空");
        }
        if (tenantMapper.selectByCode(tenant.getTenantCode().trim()) != null) {
            throw new BusinessException(409, "租户编码已存在: " + tenant.getTenantCode());
        }
        tenant.setTenantCode(tenant.getTenantCode().trim());
        tenant.setTenantName(tenant.getTenantName().trim());
        if (tenant.getStatus() == null) {
            tenant.setStatus(1);
        }
        tenantMapper.insert(tenant);
        return tenantMapper.selectById(tenant.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysTenant updateTenant(SysTenant tenant) {
        if (tenant.getId() == null) {
            throw new BusinessException(400, "租户ID不能为空");
        }
        SysTenant existing = tenantMapper.selectById(tenant.getId());
        if (existing == null) {
            throw new BusinessException(404, "租户不存在");
        }
        // 如果修改了编码，检查唯一性
        if (tenant.getTenantCode() != null && !tenant.getTenantCode().equals(existing.getTenantCode())) {
            if (tenantMapper.selectByCode(tenant.getTenantCode()) != null) {
                throw new BusinessException(409, "租户编码已存在: " + tenant.getTenantCode());
            }
        }
        tenantMapper.update(tenant);
        return tenantMapper.selectById(tenant.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTenant(Long id) {
        if (id == null) {
            throw new BusinessException(400, "租户ID不能为空");
        }
        SysTenant existing = tenantMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "租户不存在");
        }
        tenantMapper.deleteById(id);
    }

    @Override
    public SysTenant getTenantById(Long id) {
        return tenantMapper.selectById(id);
    }

    @Override
    public SysTenant getTenantByCode(String tenantCode) {
        return tenantMapper.selectByCode(tenantCode);
    }

    @Override
    public Map<String, Object> listTenants(String keyword, Integer status, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<SysTenant> list = tenantMapper.selectAll(keyword, status, offset, pageSize);
        int total = tenantMapper.countAll(keyword, status);
        Map<String, Object> result = new HashMap<>();
        result.put("list", list);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        return result;
    }
}
