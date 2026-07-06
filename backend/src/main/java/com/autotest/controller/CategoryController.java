package com.autotest.controller;

import com.autotest.model.entity.SysCategory;
import com.autotest.model.vo.Result;
import com.autotest.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/category")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    @GetMapping("/tree")
    public Result<?> getTree() {
        List<SysCategory> tree = categoryService.getTree(null);
        return Result.success(tree);
    }

    @GetMapping("/detail")
    public Result<?> getDetail(@RequestParam Long id) {
        SysCategory category = categoryService.getById(id);
        return Result.success(category);
    }

    @PostMapping("/create")
    public Result<?> createCategory(@RequestBody Map<String, Object> params) {
        SysCategory category = new SysCategory();
        category.setParentId(params.get("parentId") != null ? Long.valueOf(params.get("parentId").toString()) : 0L);
        category.setCategoryName((String) params.get("categoryName"));
        category.setSortOrder(params.get("sortOrder") != null ? Integer.valueOf(params.get("sortOrder").toString()) : 0);
        category.setIcon((String) params.get("icon"));
        category.setStatus(params.get("status") != null ? Integer.valueOf(params.get("status").toString()) : 1);
        SysCategory created = categoryService.create(category);
        return Result.success(created);
    }

    @PutMapping("/update")
    public Result<?> updateCategory(@RequestParam Long id, @RequestBody Map<String, Object> params) {
        SysCategory category = new SysCategory();
        category.setId(id);
        if (params.get("categoryName") != null) category.setCategoryName((String) params.get("categoryName"));
        if (params.get("sortOrder") != null) category.setSortOrder(Integer.valueOf(params.get("sortOrder").toString()));
        if (params.get("status") != null) category.setStatus(Integer.valueOf(params.get("status").toString()));
        if (params.get("icon") != null) category.setIcon((String) params.get("icon"));
        SysCategory updated = categoryService.update(category);
        return Result.success(updated);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteCategory(@RequestParam Long id) {
        categoryService.deleteById(id);
        return Result.success();
    }

    @PutMapping("/sort")
    public Result<?> updateSort(@RequestBody Map<String, Object> params) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) params.get("items");
        if (items != null) {
            for (Map<String, Object> item : items) {
                Long itemId = Long.valueOf(item.get("id").toString());
                Integer sortOrder = Integer.valueOf(item.get("sortOrder").toString());
                categoryService.updateSort(itemId, sortOrder);
            }
        }
        return Result.success();
    }
}
