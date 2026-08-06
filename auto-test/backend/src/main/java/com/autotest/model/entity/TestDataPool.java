package com.autotest.model.entity;

import java.util.Date;

/**
 * 数据池实体，对应表 test_data_pool。
 */
public class TestDataPool {
    private Long id;
    private String poolCode;
    private String poolName;
    private Long tenantId;
    private String productCode;
    private String description;
    private String columnDefs;
    private Integer status;
    private String createBy;
    private Date createTime;
    private Date updateTime;

    /** 非持久化字段：行数（列表查询时填充） */
    private transient Integer rowCount;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPoolCode() { return poolCode; }
    public void setPoolCode(String poolCode) { this.poolCode = poolCode; }
    public String getPoolName() { return poolName; }
    public void setPoolName(String poolName) { this.poolName = poolName; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getColumnDefs() { return columnDefs; }
    public void setColumnDefs(String columnDefs) { this.columnDefs = columnDefs; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    public Integer getRowCount() { return rowCount; }
    public void setRowCount(Integer rowCount) { this.rowCount = rowCount; }
}
