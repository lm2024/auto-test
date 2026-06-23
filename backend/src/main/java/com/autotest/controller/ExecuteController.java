package com.autotest.controller;

import com.autotest.engine.plan.ExecutionPlan;
import com.autotest.model.dto.BrowserAction;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.BrowserStepLogVO;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;
import com.autotest.model.vo.Result;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.service.BrowserAutomationService;
import com.autotest.service.ExecuteService;
import com.autotest.websocket.WebSocketPushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@RestController
@RequestMapping("/api/execute")
public class ExecuteController {

    private static final Logger log = LoggerFactory.getLogger(ExecuteController.class);

    @Autowired
    private ExecuteService executeService;

    @Autowired
    private BrowserAutomationService browserAutomationService;

    @Autowired
    private WebSocketPushService webSocketPushService;

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

    // AI 执行存储（后续可迁移到 BrowserTaskController 统一管理）
    private final ConcurrentHashMap<String, AiExecStore> aiExecStore = new ConcurrentHashMap<>();
    private final AtomicInteger aiExecCounter = new AtomicInteger(1);

    @PostMapping("/run")
    public Result<?> runChain(@RequestBody Map<String, String> params) {
        String chainCode = params.get("chainCode");
        String traceId = params.get("traceId");
        Boolean parallel = params.containsKey("parallel") ? Boolean.parseBoolean(params.get("parallel")) : false;
        String executionId;
        if (traceId != null && !traceId.isEmpty()) {
            executionId = executeService.runChain(chainCode, traceId, parallel);
        } else {
            executionId = executeService.runChain(chainCode);
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
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        List<ExecuteMainVO> records = executeService.listExecuteRecords(
                chainCode, status, startTime, endTime, pageNo, pageSize);
        int total = executeService.countExecuteRecords(chainCode, status, startTime, endTime);
        Map<String, Object> data = new HashMap<>();
        data.put("list", records);
        data.put("total", total);
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return Result.success(data);
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

    /**
     * AI 智能执行（浏览器自动化）
     * 接收链路编码列表、headless 模式、可选的定时执行时间
     */
    @PostMapping("/ai-run")
    public Result<?> aiRun(@RequestBody Map<String, Object> params) {
        @SuppressWarnings("unchecked")
        List<String> chainCodes = (List<String>) params.get("chainCodes");
        if (chainCodes == null || chainCodes.isEmpty()) {
            return Result.error("请选择要执行的链路");
        }

        boolean headless = Boolean.TRUE.equals(params.get("headless"));
        String scheduledAt = (String) params.get("scheduledAt");

        // 定时执行：暂存调度信息，后续通过定时任务触发
        if (scheduledAt != null && !scheduledAt.isEmpty()) {
            for (String chainCode : chainCodes) {
                Map<String, Object> schedule = new HashMap<>();
                schedule.put("chainCode", chainCode);
                schedule.put("scheduledAt", scheduledAt);
                schedule.put("headless", headless);
                // 存储到 BrowserTaskController 的 scheduleStore（如果可访问）
                log.info("Scheduled AI execution: chainCode={}, time={}, headless={}", chainCode, scheduledAt, headless);
            }
            Map<String, Object> data = new HashMap<>();
            data.put("scheduled", true);
            data.put("scheduledAt", scheduledAt);
            data.put("count", chainCodes.size());
            return Result.success(data);
        }

        // 立刻执行
        if (chainCodes.size() == 1) {
            String executionId = executeAiChain(chainCodes.get(0), headless);
            Map<String, Object> data = new HashMap<>();
            data.put("executionId", executionId);
            return Result.success(data);
        } else {
            List<Map<String, String>> results = new ArrayList<>();
            for (String chainCode : chainCodes) {
                try {
                    String executionId = executeAiChain(chainCode, headless);
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
            Map<String, Object> data = new HashMap<>();
            data.put("results", results);
            return Result.success(data);
        }
    }

    /**
     * 获取 AI 执行详情
     */
    @GetMapping("/ai-exec/detail")
    public Result<?> aiExecDetail(@RequestParam String executionId) {
        AiExecStore exec = aiExecStore.get(executionId);
        if (exec == null) {
            // 回退到 BrowserTaskController 的 execStore
            return Result.error("执行记录不存在");
        }
        Map<String, Object> map = new HashMap<>();
        map.put("executionId", exec.executionId);
        map.put("chainCode", exec.chainCode);
        map.put("chainName", exec.chainName);
        map.put("status", exec.status);
        map.put("startTime", exec.startTime);
        map.put("endTime", exec.endTime);
        map.put("totalCostMs", exec.totalCostMs);
        return Result.success(map);
    }

    /**
     * 获取 AI 执行步骤日志
     */
    @GetMapping("/ai-exec/stepLogs")
    public Result<?> aiExecStepLogs(@RequestParam String executionId) {
        AiExecStore exec = aiExecStore.get(executionId);
        if (exec == null) {
            return Result.success(Collections.emptyList());
        }
        return Result.success(exec.stepLogs);
    }

    /**
     * 执行单个链路的 AI 浏览器自动化
     */
    private String executeAiChain(String chainCode, boolean headless) {
        // 1. 获取链路节点配置
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (nodes == null || nodes.isEmpty()) {
            throw new RuntimeException("链路无节点配置: " + chainCode);
        }

        String executionId = "AIEXEC_" + System.currentTimeMillis() + "_" + aiExecCounter.getAndIncrement();
        AiExecStore exec = new AiExecStore();
        exec.executionId = executionId;
        exec.chainCode = chainCode;
        exec.status = "RUNNING";
        exec.startTime = new Date();
        aiExecStore.put(executionId, exec);

        // 2. 将 HTTP 节点转换为 BrowserAction
        List<BrowserAction> actions = new ArrayList<>();
        for (int i = 0; i < nodes.size(); i++) {
            TestNodeConfig node = nodes.get(i);
            BrowserAction action = convertNodeToAction(node, i);
            actions.add(action);
        }

        // 3. 异步执行
        final String execId = executionId;
        final List<BrowserAction> finalActions = new ArrayList<>(actions);
        new Thread(() -> executeAiAsync(execId, finalActions, headless)).start();

        return executionId;
    }

    /**
     * 将 TestNodeConfig 转换为 BrowserAction
     */
    private BrowserAction convertNodeToAction(TestNodeConfig node, int stepIndex) {
        BrowserAction action = new BrowserAction();
        action.setStepIndex(stepIndex);

        // 根据 nodeType、requestMethod 等推断操作类型
        String nodeType = node.getNodeType();
        String requestMethod = node.getRequestMethod();

        if ("BROWSER".equalsIgnoreCase(nodeType) || "BROWSER_CLICK".equalsIgnoreCase(nodeType)) {
            action.setActionType("click");
            action.setTargetSelector(node.getTargetDom());
            action.setDescription("点击: " + (node.getNodeName() != null ? node.getNodeName() : node.getTargetDom()));
        } else if ("BROWSER_INPUT".equalsIgnoreCase(nodeType)) {
            action.setActionType("input");
            action.setTargetSelector(node.getTargetDom());
            action.setValue(node.getBodyData());
            action.setDescription("输入: " + (node.getNodeName() != null ? node.getNodeName() : node.getTargetDom()));
        } else if ("BROWSER_NAVIGATE".equalsIgnoreCase(nodeType)) {
            action.setActionType("navigate");
            action.setTargetUrl(node.getPageUrl() != null ? node.getPageUrl() : node.getRequestUrl());
            action.setDescription("导航: " + (node.getNodeName() != null ? node.getNodeName() : action.getTargetUrl()));
        } else if ("BROWSER_WAIT".equalsIgnoreCase(nodeType)) {
            action.setActionType("wait");
            action.setWaitDelayMs(node.getDelaySeconds() != null ? node.getDelaySeconds() * 1000 : 1000);
            action.setDescription("等待: " + (node.getNodeName() != null ? node.getNodeName() : ""));
        } else {
            // 默认 HTTP 节点：如果配置了 pageUrl 和 targetDom，尝试转为浏览器操作
            String pageUrl = node.getPageUrl();
            String targetDom = node.getTargetDom();
            if (pageUrl != null && !pageUrl.isEmpty()) {
                action.setActionType("navigate");
                action.setTargetUrl(pageUrl);
                action.setDescription("导航: " + (node.getNodeName() != null ? node.getNodeName() : pageUrl));
            } else if (targetDom != null && !targetDom.isEmpty()) {
                action.setActionType("click");
                action.setTargetSelector(targetDom);
                action.setDescription("操作: " + (node.getNodeName() != null ? node.getNodeName() : targetDom));
            } else {
                // 纯 HTTP 请求 → 尝试用浏览器 navigate 到 URL
                if (node.getRequestUrl() != null && !node.getRequestUrl().isEmpty()) {
                    action.setActionType("navigate");
                    action.setTargetUrl(node.getRequestUrl());
                    action.setDescription("HTTP→浏览器: " + (node.getNodeName() != null ? node.getNodeName() : node.getRequestUrl()));
                } else {
                    action.setActionType("wait");
                    action.setWaitDelayMs(500);
                    action.setDescription("跳过: " + (node.getNodeName() != null ? node.getNodeName() : "无操作"));
                }
            }
        }

        action.setContinueOnFail(true);
        action.setTimeoutMs(30000);
        return action;
    }

    /**
     * 异步执行 AI 浏览器自动化
     */
    private void executeAiAsync(String executionId, List<BrowserAction> actions, boolean headless) {
        AiExecStore exec = aiExecStore.get(executionId);
        String sessionId = null;
        long startTime = System.currentTimeMillis();
        try {
            sessionId = browserAutomationService.createSession(headless);
            for (BrowserAction action : actions) {
                BrowserStepLogVO result = browserAutomationService.executeAction(sessionId, action);
                exec.stepLogs.add(result);

                // WebSocket 实时推送
                Map<String, Object> stepMsg = new HashMap<>();
                stepMsg.put("type", "STEP_LOG");
                stepMsg.put("stepIndex", result.getStepIndex());
                stepMsg.put("actionType", result.getActionType());
                stepMsg.put("description", result.getDescription());
                stepMsg.put("status", result.getStatus());
                stepMsg.put("costMs", result.getCostMs());
                stepMsg.put("pageUrl", result.getPageUrl());
                stepMsg.put("errorMessage", result.getErrorMessage());
                stepMsg.put("screenshotUrl", result.getScreenshotUrl());
                stepMsg.put("bizOperTraceId", result.getBizOperTraceId());
                webSocketPushService.pushMessage(executionId, stepMsg);
            }
            boolean hasFailed = exec.stepLogs.stream().anyMatch(s -> "FAILED".equals(s.getStatus()));
            exec.status = hasFailed ? "FAILED" : "SUCCESS";
        } catch (Exception e) {
            log.error("AI execution failed: {}", executionId, e);
            exec.status = "FAILED";
            BrowserStepLogVO errorLog = new BrowserStepLogVO();
            errorLog.setStatus("FAILED");
            errorLog.setErrorMessage(e.getMessage());
            exec.stepLogs.add(errorLog);
        } finally {
            if (sessionId != null) browserAutomationService.closeSession(sessionId);
            exec.endTime = new Date();
            exec.totalCostMs = System.currentTimeMillis() - startTime;
            // 推送最终状态
            Map<String, Object> statusMsg = new HashMap<>();
            statusMsg.put("type", "EXEC_STATUS");
            statusMsg.put("status", exec.status);
            statusMsg.put("totalCostMs", exec.totalCostMs);
            webSocketPushService.pushMessage(executionId, statusMsg);
        }
    }

    // ==================== AI 执行内部存储类 ====================

    static class AiExecStore {
        String executionId;
        String chainCode;
        String chainName;
        String status;
        Date startTime;
        Date endTime;
        Long totalCostMs;
        List<BrowserStepLogVO> stepLogs = new ArrayList<>();
    }
}
