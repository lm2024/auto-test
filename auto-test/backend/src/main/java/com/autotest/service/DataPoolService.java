package com.autotest.service;

import com.autotest.model.entity.TestDataPool;
import com.autotest.model.entity.TestDataPoolRow;

import java.util.List;
import java.util.Map;

public interface DataPoolService {
    TestDataPool createPool(TestDataPool pool);
    TestDataPool updatePool(TestDataPool pool);
    void deletePool(Long id);
    TestDataPool getPoolById(Long id);
    TestDataPool getPoolByCode(String poolCode);
    Map<String, Object> listPools(Long tenantId, String productCode, String poolName,
                                   Integer status, int page, int pageSize);

    // 行数据操作
    TestDataPoolRow addRow(TestDataPoolRow row);
    TestDataPoolRow updateRow(TestDataPoolRow row);
    void deleteRow(Long id);
    void deleteRowsByPoolId(Long poolId);
    Map<String, Object> listRows(Long poolId, int page, int pageSize);
    int countRows(Long poolId);

    // 从数据池取参数（执行引擎使用）
    Map<String, Object> getRowVars(String poolCode, int rowIndex);

    // 批量导入
    void importRows(Long poolId, List<Map<String, Object>> rows);
}
