package com.autotest.controller;

import com.autotest.model.dto.dict.DictCategoryCreateDTO;
import com.autotest.model.entity.DictCategory;
import com.autotest.model.vo.Result;
import com.autotest.service.DictCategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    public Result<?> listCategories(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Integer pageNo,
            @RequestParam(required = false) Integer pageSize) {
        // pageNo/pageSize 为空时返回全部（供下拉框使用），有值时分页
        boolean paged = pageNo != null && pageSize != null && pageSize > 0;
        int offset = paged ? (pageNo - 1) * pageSize : 0;
        int limit = paged ? pageSize : 10000;

        List<DictCategory> list;
        int total;
        if (type != null && !type.isEmpty()) {
            list = dictCategoryService.listByType(type, offset, limit);
            total = dictCategoryService.countByType(type);
        } else {
            list = dictCategoryService.listAll(offset, limit);
            total = dictCategoryService.countAll();
        }

        if (paged) {
            Map<String, Object> data = new HashMap<>();
            data.put("list", list);
            data.put("total", total);
            data.put("pageNo", pageNo);
            data.put("pageSize", pageSize);
            return Result.success(data);
        }
        return Result.success(list);
    }
}