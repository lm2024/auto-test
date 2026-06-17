package com.autotest.service;

import com.autotest.model.dto.dict.DictCategoryCreateDTO;
import com.autotest.model.entity.DictCategory;

import java.util.List;

public interface DictCategoryService {
    DictCategory createCategory(DictCategoryCreateDTO dto);
