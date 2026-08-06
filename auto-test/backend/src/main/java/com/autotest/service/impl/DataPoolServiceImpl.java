package com.autotest.service.impl;

import com.autotest.context.TenantContext;
import com.autotest.exception.BusinessException;
import com.autotest.mapper.TestDataPoolMapper;
import com.autotest.mapper.TestDataPoolRowMapper;
import com.autotest.model.entity.TestDataPool;
import com.autotest.model.entity.TestDataPoolRow;
import com.autotest.service.DataPoolService;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class DataPoolServiceImpl implements DataPoolService {

    private static final Logger log = LoggerFactory.getLogger(DataPoolServiceImpl.class);

    @Autowired
    private TestDataPoolMapper poolMapper;

    @Autowired
    private TestDataPoolRowMapper rowMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestDataPool createPool(TestDataPool pool) {
        if (pool.getPoolCode() == null || pool.getPoolCode().trim().isEmpty()) {
            throw new BusinessException(400, "数据池编码不能为空");
        }
        if (pool.getPoolName() == null || pool.getPoolName().trim().isEmpty()) {
            throw new BusinessException(400, "数据池名称不能为空");
        }
        if (pool.getColumnDefs() == null || pool.getColumnDefs().trim().isEmpty()) {
            throw new BusinessException(400, "列定义不能为空");
        }
        if (poolMapper.selectByPoolCode(pool.getPoolCode().trim()) != null) {
            throw new BusinessException(409, "数据池编码已存在: " + pool.getPoolCode());
        }
        pool.setPoolCode(pool.getPoolCode().trim());
        pool.setPoolName(pool.getPoolName().trim());
        if (pool.getStatus() == null) {
            pool.setStatus(1);
        }
        // 自动设置 tenantId
        if (pool.getTenantId() == null) {
            pool.setTenantId(TenantContext.getTenantId());
        }
        poolMapper.insert(pool);
        return poolMapper.selectById(pool.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestDataPool updatePool(TestDataPool pool) {
        if (pool.getId() == null) {
            throw new BusinessException(400, "数据池ID不能为空");
        }
        TestDataPool existing = poolMapper.selectById(pool.getId());
        if (existing == null) {
            throw new BusinessException(404, "数据池不存在");
        }
        poolMapper.update(pool);
        return poolMapper.selectById(pool.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deletePool(Long id) {
        if (id == null) {
            throw new BusinessException(400, "数据池ID不能为空");
        }
        TestDataPool existing = poolMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "数据池不存在");
        }
        // 先删除行数据
        rowMapper.deleteByPoolId(id);
        // 再删除数据池
        poolMapper.deleteById(id);
    }

    @Override
    public TestDataPool getPoolById(Long id) {
        return poolMapper.selectById(id);
    }

    @Override
    public TestDataPool getPoolByCode(String poolCode) {
        return poolMapper.selectByPoolCode(poolCode);
    }

    @Override
    public Map<String, Object> listPools(Long tenantId, String productCode, String poolName,
                                          Integer status, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<TestDataPool> list = poolMapper.selectList(tenantId, productCode, poolName, status, offset, pageSize);
        int total = poolMapper.countList(tenantId, productCode, poolName, status);

        // 为每个数据池附加行数
        for (TestDataPool pool : list) {
            pool.setRowCount(poolMapper.countRows(pool.getId()));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("list", list);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestDataPoolRow addRow(TestDataPoolRow row) {
        if (row.getPoolId() == null) {
            throw new BusinessException(400, "数据池ID不能为空");
        }
        if (row.getRowData() == null || row.getRowData().trim().isEmpty()) {
            throw new BusinessException(400, "行数据不能为空");
        }
        // 自动计算行号
        if (row.getRowIndex() == null) {
            int count = rowMapper.countByPoolId(row.getPoolId());
            row.setRowIndex(count);
        }
        rowMapper.insert(row);
        return rowMapper.selectById(row.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestDataPoolRow updateRow(TestDataPoolRow row) {
        if (row.getId() == null) {
            throw new BusinessException(400, "行ID不能为空");
        }
        TestDataPoolRow existing = rowMapper.selectById(row.getId());
        if (existing == null) {
            throw new BusinessException(404, "行数据不存在");
        }
        rowMapper.update(row);
        return rowMapper.selectById(row.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRow(Long id) {
        if (id == null) {
            throw new BusinessException(400, "行ID不能为空");
        }
        rowMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRowsByPoolId(Long poolId) {
        rowMapper.deleteByPoolId(poolId);
    }

    @Override
    public Map<String, Object> listRows(Long poolId, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<TestDataPoolRow> list = rowMapper.selectByPoolId(poolId, offset, pageSize);
        int total = rowMapper.countByPoolId(poolId);
        Map<String, Object> result = new HashMap<>();
        result.put("list", list);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        return result;
    }

    @Override
    public int countRows(Long poolId) {
        return rowMapper.countByPoolId(poolId);
    }

    @Override
    public Map<String, Object> getRowVars(String poolCode, int rowIndex) {
        TestDataPool pool = poolMapper.selectByPoolCode(poolCode);
        if (pool == null) {
            throw new BusinessException(404, "数据池不存在: " + poolCode);
        }
        TestDataPoolRow row = rowMapper.selectByPoolIdAndRowIndex(pool.getId(), rowIndex);
        if (row == null) {
            log.warn("[DataPool] 数据池 {} 没有第 {} 行数据", poolCode, rowIndex);
            return new HashMap<>();
        }
        // 解析 JSON 行数据为 Map
        Map<String, Object> vars = new HashMap<>();
        try {
            JSONObject json = JSON.parseObject(row.getRowData());
            vars.putAll(json);
        } catch (Exception e) {
            log.error("[DataPool] 解析行数据失败: poolCode={}, rowIndex={}", poolCode, rowIndex, e);
        }
        return vars;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void importRows(Long poolId, List<Map<String, Object>> rows) {
        if (poolId == null || rows == null || rows.isEmpty()) {
            return;
        }
        // 先清空现有行数据
        rowMapper.deleteByPoolId(poolId);

        List<TestDataPoolRow> batchRows = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            TestDataPoolRow row = new TestDataPoolRow();
            row.setPoolId(poolId);
            row.setRowIndex(i);
            row.setRowData(JSON.toJSONString(rows.get(i)));
            batchRows.add(row);
        }
        // 分批插入（每批 100 条）
        int batchSize = 100;
        for (int i = 0; i < batchRows.size(); i += batchSize) {
            int end = Math.min(i + batchSize, batchRows.size());
            rowMapper.batchInsert(batchRows.subList(i, end));
        }
    }
}
