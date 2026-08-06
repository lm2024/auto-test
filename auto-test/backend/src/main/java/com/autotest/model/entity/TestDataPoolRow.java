package com.autotest.model.entity;

import java.util.Date;

/**
 * 数据池行数据实体，对应表 test_data_pool_row。
 */
public class TestDataPoolRow {
    private Long id;
    private Long poolId;
    private Integer rowIndex;
    private String rowData;
    private Date createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPoolId() { return poolId; }
    public void setPoolId(Long poolId) { this.poolId = poolId; }
    public Integer getRowIndex() { return rowIndex; }
    public void setRowIndex(Integer rowIndex) { this.rowIndex = rowIndex; }
    public String getRowData() { return rowData; }
    public void setRowData(String rowData) { this.rowData = rowData; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
}
