package com.autotest.model.dto.dict;

/**
 * 分类字典创建/更新 DTO
 */
public class DictCategoryCreateDTO {
    private String categoryType;
    private String categoryCode;
    private String categoryName;
    private Integer sortOrder;

    public String getCategoryType() { return categoryType; }
    public void setCategoryType(String categoryType) { this.categoryType = categoryType; }
    public String getCategoryCode() { return categoryCode; }
    public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}