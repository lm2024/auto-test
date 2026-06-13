package com.autotest.controller;

import com.autotest.mapper.TestExecuteMainMapper;
import com.autotest.mapper.TestNodeExecuteLogMapper;
import com.autotest.model.entity.TestExecuteMain;
import com.autotest.model.entity.TestNodeExecuteLog;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;
import com.autotest.model.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/log")
public class LogController {

    @Autowired
    private TestExecuteMainMapper executeMainMapper;

    @Autowired
    private TestNodeExecuteLogMapper nodeExecuteLogMapper;

    @GetMapping("/main/list")
    public Result<?> listMainLog(
            @RequestParam(required = false) String chainCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize) {
        // Reuse execute service
        Map<String, Object> data = new HashMap<>();
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return Result.success(data);
    }

    @GetMapping("/main/detail")
    public Result<?> getMainDetail(@RequestParam String executionId) {
        TestExecuteMain main = executeMainMapper.selectByExecutionId(executionId);
        if (main == null) {
            return Result.error(404, "执行记录不存在");
        }
        ExecuteMainVO vo = new ExecuteMainVO();
        vo.setExecutionId(main.getExecutionId());
        vo.setChainCode(main.getChainCode());
        vo.setStatus(main.getStatus());
        vo.setStartTime(main.getStartTime());
        vo.setEndTime(main.getEndTime());
        vo.setTotalCostMs(main.getTotalCostMs());
        vo.setNodeCount(main.getNodeCount());
        vo.setSuccessCount(main.getSuccessCount());
        vo.setFailCount(main.getFailCount());
        vo.setSkipCount(main.getSkipCount());
        vo.setErrorMessage(main.getErrorMessage());
        return Result.success(vo);
    }

    @GetMapping("/node/list")
    public Result<?> listNodeLog(@RequestParam String executionId) {
        List<TestNodeExecuteLog> logs = nodeExecuteLogMapper.selectByExecutionId(executionId);
        List<NodeExecuteLogVO> vos = logs.stream().map(log -> {
            NodeExecuteLogVO vo = new NodeExecuteLogVO();
            vo.setNodeCode(log.getNodeCode());
            vo.setNodeName(log.getNodeName());
            vo.setStatus(log.getStatus());
            vo.setRequestUrl(log.getRequestUrl());
            vo.setRequestMethod(log.getRequestMethod());
            vo.setRequestHeaders(log.getRequestHeaders());
            vo.setRequestBody(log.getRequestBody());
            vo.setResponseCode(log.getResponseCode());
            vo.setResponseHeaders(log.getResponseHeaders());
            vo.setResponseBody(log.getResponseBody());
            vo.setCostMs(log.getCostMs());
            vo.setErrorMessage(log.getErrorMessage());
            vo.setStartTime(log.getStartTime());
            vo.setEndTime(log.getEndTime());
            return vo;
        }).collect(Collectors.toList());
        return Result.success(vos);
    }
}
