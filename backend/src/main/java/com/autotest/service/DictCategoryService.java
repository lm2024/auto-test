package com.autotest.service;

import com.autotest.model.dto.dict.DictCategoryCreateDTO;
import com.autotest.model.entity.DictCategory;

import java.util.List;

public interface DictCategoryService {
    DictCategory createCategory(DictCategoryCreateDTO dto);
    DictCategory updateCategory(Long id, DictCategoryCreateDTO dto);
    void deleteCategory(Long id);
    List<DictCategory> listByType(String categoryType, int offset, int pageSize);
    int countByType(String categoryType);
    List<DictCategory> listAll(int offset, int pageSize);
    int countAll();
}