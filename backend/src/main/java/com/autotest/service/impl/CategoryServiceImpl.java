package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysCategoryMapper;
import com.autotest.model.entity.SysCategory;
import com.autotest.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CategoryServiceImpl implements CategoryService {

    @Autowired
    private SysCategoryMapper categoryMapper;

    @Override
    public List<SysCategory> getTree(Long tenantId) {
        List<SysCategory> all = categoryMapper.selectAll(tenantId);
        return buildTree(all, 0L);
    }

    @Override
    public SysCategory getById(Long id) {
        SysCategory category = categoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException(404, "分类不存在");
        }
        return category;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysCategory create(SysCategory category) {
        if (category.getParentId() == null) category.setParentId(0L);
        if (category.getStatus() == null) category.setStatus(1);
        categoryMapper.insert(category);
        return categoryMapper.selectById(category.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysCategory update(SysCategory category) {
        SysCategory existing = categoryMapper.selectById(category.getId());
        if (existing == null) {
            throw new BusinessException(404, "分类不存在");
        }
        categoryMapper.update(category);
        return categoryMapper.selectById(category.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Long id) {
        SysCategory existing = categoryMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "分类不存在");
        }
        // Recursively delete children
        deleteChildren(id);
        categoryMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateSort(Long id, Integer sortOrder) {
        categoryMapper.updateSort(id, sortOrder);
    }

    private void deleteChildren(Long parentId) {
        List<SysCategory> children = categoryMapper.selectByParentId(parentId, null);
        for (SysCategory child : children) {
            deleteChildren(child.getId());
            categoryMapper.deleteById(child.getId());
        }
    }

    private List<SysCategory> buildTree(List<SysCategory> all, Long parentId) {
        return all.stream()
                .filter(c -> parentId.equals(c.getParentId()))
                .peek(c -> c.setChildren(buildTree(all, c.getId())))
                .collect(Collectors.toList());
    }
}
