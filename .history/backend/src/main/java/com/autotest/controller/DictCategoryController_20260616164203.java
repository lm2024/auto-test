package com.autotest.controller;

import com.autotest.model.dto.dict.DictCategoryCreateDTO;
import com.autotest.model.entity.DictCategory;
import com.autotest.model.vo.Result;
import com.autotest.service.DictCategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dict/category")
