package com.autotest.service.impl;

import com.autotest.mapper.SysSystemRegistryMapper;
import com.autotest.model.entity.SysSystemRegistry;
import com.autotest.model.vo.ClassifyResult;
import com.autotest.service.SystemRegistryService;
import com.autotest.util.InterfaceClassifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 系统注册表服务实现，写操作后主动失效分类器缓存。
 */
@Service
public class SystemRegistryServiceImpl implements SystemRegistryService {

    @Autowired
    private SysSystemRegistryMapper registryMapper;

    @Autowired
    private InterfaceClassifier interfaceClassifier;

    @Override
    public List<SysSystemRegistry> listAll() {
        List<SysSystemRegistry> list = registryMapper.selectAll();
        return list == null ? new ArrayList<SysSystemRegistry>() : list;
    }

    @Override
    public SysSystemRegistry saveRegistry(SysSystemRegistry registry) {
        if (registry == null) {
            throw new IllegalArgumentException("系统注册信息不能为空");
        }
        if (isBlank(registry.getSystemCode())) {
            throw new IllegalArgumentException("systemCode 不能为空");
        }
        if (isBlank(registry.getSystemName())) {
            throw new IllegalArgumentException("systemName 不能为空");
        }
        registry.setSystemCode(registry.getSystemCode().trim());
        registry.setSystemName(registry.getSystemName().trim());
        if (isBlank(registry.getScope())) {
            registry.setScope(InterfaceClassifier.SCOPE_INTERNAL);
        } else {
            registry.setScope(registry.getScope().trim().toUpperCase());
        }

        if (registry.getId() == null) {
            SysSystemRegistry exists = registryMapper.selectBySystemCode(registry.getSystemCode());
            if (exists != null) {
                throw new IllegalArgumentException("systemCode 已存在: " + registry.getSystemCode());
            }
            registryMapper.insert(registry);
        } else {
            registryMapper.update(registry);
        }
        interfaceClassifier.invalidateCache();

        SysSystemRegistry saved = registryMapper.selectById(registry.getId());
        return saved != null ? saved : registry;
    }

    @Override
    public void deleteRegistry(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("系统ID不能为空");
        }
        registryMapper.deleteById(id);
        interfaceClassifier.invalidateCache();
    }

    @Override
    public ClassifyResult classify(String url) {
        return interfaceClassifier.classify(url);
    }

    private boolean isBlank(String text) {
        return text == null || text.trim().isEmpty();
    }
}
