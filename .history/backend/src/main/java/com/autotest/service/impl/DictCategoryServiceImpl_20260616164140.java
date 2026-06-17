package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.DictCategoryMapper;
import com.autotest.model.dto.dict.DictCategoryCreateDTO;
import com.autotest.model.entity.DictCategory;
import com.autotest.service.DictCategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DictCategoryServiceImpl implements DictCategoryService {

    @Autowired
    private DictCategoryMapper dictCategoryMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DictCategory createCategory(DictCategoryCreateDTO dto) {
        DictCategory category = new DictCategory();
        category.setCategoryType(dto.getCategoryType());
        category.setCategoryCode(dto.getCategoryCode());
        category.setCategoryName(dto.getCategoryName());
        category.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        dictCategoryMapper.insert(category);
        return category;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DictCategory updateCategory(Long id, DictCategoryCreateDTO dto) {
        DictCategory existing = dictCategoryMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "分类不存在");
        }
        DictCategory category = new DictCategory();
        category.setId(id);
        if (dto.getCategoryName() != null) category.setCategoryName(dto.getCategoryName());
        if (dto.getSortOrder() != null) category.setSortOrder(dto.getSortOrder());
        dictCategoryMapper.update(category);
        return dictCategoryMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteCategory(Long id) {
        dictCategoryMapper.deleteById(id);
    }

    @Override
    public List<DictCategory> listByType(String categoryType) {
        return dictCategoryMapper.selectByType(categoryType);
    }

    @Override
    public List<DictCategory> listAll() {
        return dictCategoryMapper.selectAll();
    }
}