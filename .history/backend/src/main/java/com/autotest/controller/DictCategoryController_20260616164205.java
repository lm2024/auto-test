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
public class DictCategoryController {

    @Autowired
    private DictCategoryService dictCategoryService;

    @PostMapping("/create")
    public Result<?> createCategory(@RequestBody DictCategoryCreateDTO dto) {
        DictCategory category = dictCategoryService.createCategory(dto);
        return Result.success(category);
    }

    @PutMapping("/update")
    public Result<?> updateCategory(@RequestParam Long id, @RequestBody DictCategoryCreateDTO dto) {
        DictCategory category = dictCategoryService.updateCategory(id, dto);
        return Result.success(category);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteCategory(@RequestParam Long id) {
        dictCategoryService.deleteCategory(id);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<?> listCategories(@RequestParam(required = false) String type) {
        List<DictCategory> list;
        if (type != null && !type.isEmpty()) {
            list = dictCategoryService.listByType(type);
        } else {
            list = dictCategoryService.listAll();
        }
        return Result.success(list);
    }
}