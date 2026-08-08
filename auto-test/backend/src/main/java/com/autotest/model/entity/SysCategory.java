package com.autotest.model.entity;

import java.util.Date;
import java.util.List;

public class SysCategory {
    private Long id;
    private Long parentId;
    private String categoryName;
    private Integer sortOrder;
    private String icon;
    private Long tenantId;
    private Integer status;
    private Date createTime;
    private Date updateTime;

    private List<SysCategory> children;
    /** 是否存在可展示的子节点，供前端懒加载使用。 */
    private boolean hasChildren;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    public List<SysCategory> getChildren() { return children; }
    public void setChildren(List<SysCategory> children) { this.children = children; }
    public boolean isHasChildren() { return hasChildren; }
    public void setHasChildren(boolean hasChildren) { this.hasChildren = hasChildren; }
}
