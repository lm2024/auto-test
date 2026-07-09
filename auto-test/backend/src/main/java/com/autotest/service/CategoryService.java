package com.autotest.service;

import com.autotest.model.entity.SysCategory;

import java.util.List;

public interface CategoryService {
    List<SysCategory> getTree(Long tenantId);
    SysCategory getById(Long id);
    SysCategory create(SysCategory category);
    SysCategory update(SysCategory category);
    void deleteById(Long id);
    void updateSort(Long id, Integer sortOrder);
}
