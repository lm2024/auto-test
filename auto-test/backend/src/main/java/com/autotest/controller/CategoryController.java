package com.autotest.controller;

import com.autotest.model.entity.SysCategory;
import com.autotest.model.vo.Result;
import com.autotest.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/category")
public class CategoryController {

    private static final Logger log = LoggerFactory.getLogger(CategoryController.class);

    @Autowired
    private CategoryService categoryService;

    @GetMapping("/tree")
    public Result<?> getTree(@RequestParam(required = false) Long parentId,
                             @RequestParam(required = false) String keyword,
                             @RequestParam(defaultValue = "100") Integer limit) {
        log.info("[CATEGORY_DIAG] tree request: parentId={}, keyword={}, limit={}", parentId, keyword, limit);
        if (keyword != null && !keyword.trim().isEmpty()) {
            List<SysCategory> result = categoryService.search(keyword, null, limit);
            log.info("[CATEGORY_DIAG] tree search response: size={}, nodes={}", result.size(), summarize(result));
            return Result.success(result);
        }
        List<SysCategory> result = categoryService.getChildren(parentId == null ? 0L : parentId, null);
        log.info("[CATEGORY_DIAG] tree children response: size={}, nodes={}", result.size(), summarize(result));
        return Result.success(result);
    }

    @GetMapping("/detail")
    public Result<?> getDetail(@RequestParam Long id) {
        SysCategory category = categoryService.getById(id);
        return Result.success(category);
    }

    @PostMapping("/create")
    public Result<?> createCategory(@RequestBody Map<String, Object> params) {
        log.info("[CATEGORY_DIAG] create request: params={}", params);
        SysCategory category = new SysCategory();
        category.setParentId(params.get("parentId") != null ? Long.valueOf(params.get("parentId").toString()) : 0L);
        category.setCategoryName((String) params.get("categoryName"));
        category.setSortOrder(params.get("sortOrder") != null ? Integer.valueOf(params.get("sortOrder").toString()) : 0);
        category.setIcon((String) params.get("icon"));
        category.setStatus(params.get("status") != null ? Integer.valueOf(params.get("status").toString()) : 1);
        SysCategory created = categoryService.create(category);
        log.info("[CATEGORY_DIAG] create response: id={}, parentId={}, name={}, status={}",
                created.getId(), created.getParentId(), created.getCategoryName(), created.getStatus());
        return Result.success(created);
    }

    private String summarize(List<SysCategory> categories) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < categories.size(); i++) {
            if (i > 0) builder.append(", ");
            SysCategory item = categories.get(i);
            builder.append("{id=").append(item.getId())
                    .append(",parentId=").append(item.getParentId())
                    .append(",name=").append(item.getCategoryName())
                    .append(",hasChildren=").append(item.isHasChildren()).append('}');
            if (i >= 19 && categories.size() > 20) {
                builder.append(", ...");
                break;
            }
        }
        return builder.append(']').toString();
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
