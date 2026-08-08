package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysCategoryMapper;
import com.autotest.model.entity.SysCategory;
import com.autotest.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CategoryServiceImpl implements CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryServiceImpl.class);

    @Autowired
    private SysCategoryMapper categoryMapper;

    @Override
    public List<SysCategory> getTree(Long tenantId) {
        return getChildren(0L, tenantId);
    }

    @Override
    public List<SysCategory> getChildren(Long parentId, Long tenantId) {
        Long actualParentId = parentId == null ? 0L : parentId;
        List<SysCategory> result = categoryMapper.selectByParentId(actualParentId, tenantId);
        log.info("[CATEGORY_DIAG] mapper children result: parentId={}, tenantId={}, size={}, nodes={}",
                actualParentId, tenantId, result.size(), summarize(result));
        return result;
    }

    @Override
    public List<SysCategory> search(String keyword, Long tenantId, int limit) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getTree(tenantId);
        }
        return categoryMapper.selectByKeyword(keyword.trim(), tenantId, Math.min(Math.max(limit, 1), 200));
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
        log.info("[CATEGORY_DIAG] service insert: parentId={}, name={}, sortOrder={}, status={}",
                category.getParentId(), category.getCategoryName(), category.getSortOrder(), category.getStatus());
        categoryMapper.insert(category);
        SysCategory created = categoryMapper.selectById(category.getId());
        log.info("[CATEGORY_DIAG] service inserted: generatedId={}, persisted={}",
                category.getId(), created == null ? null : created.getCategoryName());
        return created;
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
        List<Long> descendantIds = categoryMapper.selectDescendantIds(id);
        for (int from = 0; from < descendantIds.size(); from += 500) {
            categoryMapper.deleteByIds(descendantIds.subList(from, Math.min(from + 500, descendantIds.size())));
        }
        categoryMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateSort(Long id, Integer sortOrder) {
        categoryMapper.updateSort(id, sortOrder);
    }

    private String summarize(List<SysCategory> categories) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < categories.size() && i < 20; i++) {
            if (i > 0) builder.append(", ");
            SysCategory item = categories.get(i);
            builder.append("{id=").append(item.getId())
                    .append(",name=").append(item.getCategoryName())
                    .append(",hasChildren=").append(item.isHasChildren()).append('}');
        }
        if (categories.size() > 20) builder.append(", ...");
        return builder.append(']').toString();
    }

}
