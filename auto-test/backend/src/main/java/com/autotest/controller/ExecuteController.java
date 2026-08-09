package com.autotest.controller;

import com.autotest.engine.plan.ExecutionPlan;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;
import com.autotest.model.vo.Result;
import com.autotest.service.ExecuteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/execute")
public class ExecuteController {

    @Autowired
    private ExecuteService executeService;

    @PostMapping("/run")
    public Result<?> runChain(@RequestBody Map<String, String> params, HttpServletRequest request) {
        String chainCode = params.get("chainCode");
        String traceId = params.get("traceId");
        Boolean parallel = params.containsKey("parallel") ? Boolean.parseBoolean(params.get("parallel")) : false;
        Long userId = (Long) request.getAttribute("userId");
        String operatorName = userId == null ? "手动执行" : "用户#" + userId;
        String executionId;
        if (traceId != null && !traceId.isEmpty()) {
            executionId = executeService.runChain(chainCode, traceId, parallel, userId, operatorName);
        } else {
            executionId = executeService.runChain(chainCode, null, false, userId, operatorName);
        }
        Map<String, Object> data = new HashMap<>();
        data.put("executionId", executionId);
        return Result.success(data);
    }

    @GetMapping("/status")
    public Result<?> getExecuteStatus(@RequestParam String executionId) {
        ExecuteMainVO vo = executeService.getExecuteStatus(executionId);
        return Result.success(vo);
    }

    @GetMapping("/nodeLogs")
    public Result<?> getNodeLogs(@RequestParam String executionId) {
        List<NodeExecuteLogVO> logs = executeService.getNodeLogs(executionId);
        return Result.success(logs);
    }

    @GetMapping("/list")
    public Result<?> listRecords(
            @RequestParam(required = false) String chainCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) String categoryId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        List<Long> categoryIds = parseCategoryIds(categoryId);
        List<ExecuteMainVO> records = executeService.listExecuteRecords(
                chainCode, status, startTime, endTime, categoryIds, pageNo, pageSize);
        int total = executeService.countExecuteRecords(chainCode, status, startTime, endTime, categoryIds);
        Map<String, Object> data = new HashMap<>();
        data.put("list", records);
        data.put("total", total);
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return Result.success(data);
    }

    private List<Long> parseCategoryIds(String csv) {
        if (csv == null || csv.trim().isEmpty()) return new ArrayList<>();
        try {
            return Stream.of(csv.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .map(Long::valueOf)
                    .distinct()
                    .collect(Collectors.toList());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("分类参数格式不正确");
        }
    }

    @GetMapping("/plan")
    public Result<?> getExecutionPlan(@RequestParam String chainCode) {
        ExecutionPlan plan = executeService.parseChain(chainCode);
        return Result.success(plan);
    }

    @PostMapping("/batchRun")
    public Result<?> batchRun(@RequestBody Map<String, List<String>> params) {
        List<String> chainCodes = params.get("chainCodes");
        if (chainCodes == null || chainCodes.isEmpty()) {
            return Result.error("请选择要执行的链路");
        }
        List<Map<String, String>> results = new ArrayList<>();
        for (String chainCode : chainCodes) {
            try {
                String executionId = executeService.runChain(chainCode);
                Map<String, String> item = new HashMap<>();
                item.put("chainCode", chainCode);
                item.put("executionId", executionId);
                item.put("status", "started");
                results.add(item);
            } catch (Exception e) {
                Map<String, String> item = new HashMap<>();
                item.put("chainCode", chainCode);
                item.put("status", "failed");
                item.put("message", e.getMessage());
                results.add(item);
            }
        }
        return Result.success(results);
    }
}
