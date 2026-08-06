package com.autotest.controller;

import com.autotest.model.entity.TestDataPool;
import com.autotest.model.entity.TestDataPoolRow;
import com.autotest.model.vo.Result;
import com.autotest.service.DataPoolService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 数据池管理 Controller
 * 路由前缀：/api/datapool
 */
@RestController
@RequestMapping("/api/datapool")
public class DataPoolController {

    @Autowired
    private DataPoolService dataPoolService;

    @PostMapping("/create")
    public Result<?> createPool(@RequestBody TestDataPool pool) {
        TestDataPool created = dataPoolService.createPool(pool);
        return Result.success(created);
    }

    @PutMapping("/update")
    public Result<?> updatePool(@RequestBody TestDataPool pool) {
        TestDataPool updated = dataPoolService.updatePool(pool);
        return Result.success(updated);
    }

    @DeleteMapping("/delete")
    public Result<?> deletePool(@RequestParam Long id) {
        dataPoolService.deletePool(id);
        return Result.success();
    }

    @GetMapping("/detail")
    public Result<?> getPool(@RequestParam(required = false) Long id,
                             @RequestParam(required = false) String poolCode) {
        TestDataPool pool;
        if (poolCode != null && !poolCode.isEmpty()) {
            pool = dataPoolService.getPoolByCode(poolCode);
        } else {
            pool = dataPoolService.getPoolById(id);
        }
        return Result.success(pool);
    }

    @GetMapping("/list")
    public Result<?> listPools(
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) String productCode,
            @RequestParam(required = false) String poolName,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        Map<String, Object> data = dataPoolService.listPools(tenantId, productCode, poolName, status, pageNo, pageSize);
        return Result.success(data);
    }

    // ==================== 行数据操作 ====================

    @PostMapping("/row/add")
    public Result<?> addRow(@RequestBody TestDataPoolRow row) {
        TestDataPoolRow created = dataPoolService.addRow(row);
        return Result.success(created);
    }

    @PutMapping("/row/update")
    public Result<?> updateRow(@RequestBody TestDataPoolRow row) {
        TestDataPoolRow updated = dataPoolService.updateRow(row);
        return Result.success(updated);
    }

    @DeleteMapping("/row/delete")
    public Result<?> deleteRow(@RequestParam Long id) {
        dataPoolService.deleteRow(id);
        return Result.success();
    }

    @GetMapping("/row/list")
    public Result<?> listRows(
            @RequestParam Long poolId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "100") int pageSize) {
        Map<String, Object> data = dataPoolService.listRows(poolId, pageNo, pageSize);
        return Result.success(data);
    }

    @PostMapping("/import")
    public Result<?> importCsv(
            @RequestParam Long poolId,
            @RequestParam("file") MultipartFile file) {
        try {
            String content = new String(file.getBytes(), "UTF-8");
            String[] lines = content.split("\n");
            if (lines.length < 2) {
                return Result.error("CSV 文件至少需要表头和一行数据");
            }

            // 解析表头
            String[] headers = lines[0].split(",");

            // 解析数据行
            List<Map<String, Object>> rows = new ArrayList<>();
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i].trim();
                if (line.isEmpty()) continue;
                String[] values = line.split(",");
                Map<String, Object> row = new HashMap<>();
                for (int j = 0; j < headers.length && j < values.length; j++) {
                    row.put(headers[j].trim(), values[j].trim());
                }
                rows.add(row);
            }

            dataPoolService.importRows(poolId, rows);
            return Result.success("导入成功，共 " + rows.size() + " 行");
        } catch (Exception e) {
            return Result.error("导入失败: " + e.getMessage());
        }
    }
}
