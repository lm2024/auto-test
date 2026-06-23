package com.autotest.controller;

import com.autotest.model.dto.BrowserAction;
import com.autotest.model.vo.BrowserStepLogVO;
import com.autotest.model.vo.Result;
import com.autotest.service.BrowserAutomationService;
import com.autotest.service.BrowserScriptService;
import com.autotest.websocket.WebSocketPushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/browser")
public class BrowserTaskController {

    private static final Logger log = LoggerFactory.getLogger(BrowserTaskController.class);

    @Autowired
    private BrowserAutomationService browserAutomationService;

    @Autowired(required = false)
    private BrowserScriptService browserScriptService;

    @Autowired
    private WebSocketPushService webSocketPushService;

    // 内存存储（后续替换为数据库）
    private final ConcurrentHashMap<String, BrowserTaskStore> taskStore = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, BrowserExecStore> execStore = new ConcurrentHashMap<>();
    private final AtomicInteger execIdCounter = new AtomicInteger(1);

    // ==================== 任务 CRUD ====================

    @GetMapping("/task/list")
    public Result<?> taskList(@RequestParam(required = false) String taskName,
                              @RequestParam(required = false) String status,
                              @RequestParam(defaultValue = "1") int pageNo,
                              @RequestParam(defaultValue = "10") int pageSize) {
        List<Map<String, Object>> all = taskStore.values().stream()
                .filter(t -> taskName == null || taskName.isEmpty() || t.taskName.contains(taskName))
                .sorted(Comparator.comparing(t -> t.updateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toTaskMap)
                .collect(Collectors.toList());

        int total = all.size();
        int from = (pageNo - 1) * pageSize;
        int to = Math.min(from + pageSize, total);
        List<Map<String, Object>> page = from < total ? all.subList(from, to) : Collections.emptyList();

        Map<String, Object> data = new HashMap<>();
        data.put("list", page);
        data.put("total", total);
        return Result.success(data);
    }

    @GetMapping("/task/detail")
    public Result<?> taskDetail(@RequestParam String taskCode) {
        BrowserTaskStore task = taskStore.get(taskCode);
        if (task == null) return Result.error("任务不存在");
        Map<String, Object> map = toTaskMap(task);
        map.put("actions", task.actions);
        return Result.success(map);
    }

    @PostMapping("/task/create")
    public Result<?> taskCreate(@RequestBody Map<String, String> params) {
        String taskCode = "BT_" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        BrowserTaskStore task = new BrowserTaskStore();
        task.taskCode = taskCode;
        task.taskName = params.getOrDefault("taskName", "未命名任务");
        task.targetUrl = params.getOrDefault("targetUrl", "");
        task.description = params.getOrDefault("description", "");
        task.createTime = new Date();
        task.updateTime = new Date();
        taskStore.put(taskCode, task);
        return Result.success(toTaskMap(task));
    }

    @PostMapping("/task/update")
    public Result<?> taskUpdate(@RequestBody Map<String, String> params) {
        String taskCode = params.get("taskCode");
        BrowserTaskStore task = taskStore.get(taskCode);
        if (task == null) return Result.error("任务不存在");
        if (params.containsKey("taskName")) task.taskName = params.get("taskName");
        if (params.containsKey("targetUrl")) task.targetUrl = params.get("targetUrl");
        if (params.containsKey("description")) task.description = params.get("description");
        task.updateTime = new Date();
        return Result.success(toTaskMap(task));
    }

    @PostMapping("/task/delete")
    public Result<?> taskDelete(@RequestBody Map<String, String> params) {
        taskStore.remove(params.get("taskCode"));
        return Result.success(null);
    }

    // ==================== 步骤管理 ====================

    @PostMapping("/task/step/add")
    public Result<?> stepAdd(@RequestBody Map<String, Object> params) {
        String taskCode = (String) params.get("taskCode");
        BrowserTaskStore task = taskStore.get(taskCode);
        if (task == null) return Result.error("任务不存在");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> actionMaps = (List<Map<String, Object>>) params.get("actions");
        if (actionMaps != null) {
            task.actions = actionMaps.stream().map(m -> {
                BrowserAction a = new BrowserAction();
                a.setStepIndex(toInt(m.get("stepIndex")));
                a.setActionType((String) m.get("actionType"));
                a.setActionName((String) m.get("actionName"));
                a.setTargetSelector((String) m.get("targetSelector"));
                a.setTargetUrl((String) m.get("targetUrl"));
                a.setValue((String) m.get("value"));
                a.setWaitDelayMs(toInt(m.get("waitDelayMs")));
                a.setTimeoutMs(toInt(m.get("timeoutMs")));
                a.setAssertType((String) m.get("assertType"));
                a.setAssertValue((String) m.get("assertValue"));
                a.setDescription((String) m.get("description"));
                a.setContinueOnFail(Boolean.TRUE.equals(m.get("continueOnFail")));
                return a;
            }).collect(Collectors.toList());
        }
        task.updateTime = new Date();
        return Result.success(toTaskMap(task));
    }

    // ==================== 执行 ====================

    @PostMapping("/task/execute")
    public Result<?> taskExecute(@RequestBody Map<String, String> params) {
        String taskCode = params.get("taskCode");
        BrowserTaskStore task = taskStore.get(taskCode);
        if (task == null) return Result.error("任务不存在");

        boolean headless = Boolean.parseBoolean(params.getOrDefault("headless", "false"));

        String executionId = "BEXEC_" + System.currentTimeMillis() + "_" + execIdCounter.getAndIncrement();
        BrowserExecStore exec = new BrowserExecStore();
        exec.executionId = executionId;
        exec.taskCode = taskCode;
        exec.taskName = task.taskName;
        exec.status = "RUNNING";
        exec.startTime = new Date();
        execStore.put(executionId, exec);

        // 异步执行
        final String execId = executionId;
        final List<BrowserAction> actions = new ArrayList<>(task.actions);
        final boolean fHeadless = headless;
        new Thread(() -> executeAsync(execId, actions, fHeadless)).start();

        Map<String, Object> data = new HashMap<>();
        data.put("executionId", executionId);
        return Result.success(data);
    }

    private void executeAsync(String executionId, List<BrowserAction> actions) {
        executeAsync(executionId, actions, false);
    }

    private void executeAsync(String executionId, List<BrowserAction> actions, boolean headless) {
        BrowserExecStore exec = execStore.get(executionId);
        String sessionId = null;
        long startTime = System.currentTimeMillis();
        try {
            sessionId = browserAutomationService.createSession(headless);
            for (BrowserAction action : actions) {
                BrowserStepLogVO result = browserAutomationService.executeAction(sessionId, action);
                exec.stepLogs.add(result);
                // 通过 WebSocket 实时推送步骤日志
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
            log.error("Browser execution failed: {}", executionId, e);
            exec.status = "FAILED";
            BrowserStepLogVO errorLog = new BrowserStepLogVO();
            errorLog.setStatus("FAILED");
            errorLog.setErrorMessage(e.getMessage());
            exec.stepLogs.add(errorLog);
        } finally {
            if (sessionId != null) browserAutomationService.closeSession(sessionId);
            exec.endTime = new Date();
            exec.totalCostMs = System.currentTimeMillis() - startTime;
            // 推送最终执行状态
            Map<String, Object> statusMsg = new HashMap<>();
            statusMsg.put("type", "EXEC_STATUS");
            statusMsg.put("status", exec.status);
            statusMsg.put("totalCostMs", exec.totalCostMs);
            webSocketPushService.pushMessage(executionId, statusMsg);
        }
    }

    // ==================== 执行记录 ====================

    @GetMapping("/exec/detail")
    public Result<?> execDetail(@RequestParam String executionId) {
        BrowserExecStore exec = execStore.get(executionId);
        if (exec == null) return Result.error("执行记录不存在");
        Map<String, Object> map = new HashMap<>();
        map.put("executionId", exec.executionId);
        map.put("taskCode", exec.taskCode);
        map.put("taskName", exec.taskName);
        map.put("status", exec.status);
        map.put("startTime", exec.startTime);
        map.put("endTime", exec.endTime);
        map.put("totalCostMs", exec.totalCostMs);
        return Result.success(map);
    }

    @GetMapping("/exec/stepLogs")
    public Result<?> stepLogs(@RequestParam String executionId) {
        BrowserExecStore exec = execStore.get(executionId);
        if (exec == null) return Result.success(Collections.emptyList());
        return Result.success(exec.stepLogs);
    }

    @GetMapping("/exec/list")
    public Result<?> execList(@RequestParam String taskCode,
                              @RequestParam(defaultValue = "1") int pageNo,
                              @RequestParam(defaultValue = "10") int pageSize) {
        List<Map<String, Object>> all = execStore.values().stream()
                .filter(e -> taskCode.equals(e.taskCode))
                .sorted(Comparator.comparing(e -> e.startTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("executionId", e.executionId);
                    m.put("status", e.status);
                    m.put("startTime", e.startTime);
                    m.put("totalCostMs", e.totalCostMs);
                    return m;
                })
                .collect(Collectors.toList());

        int total = all.size();
        int from = (pageNo - 1) * pageSize;
        int to = Math.min(from + pageSize, total);
        Map<String, Object> data = new HashMap<>();
        data.put("list", from < total ? all.subList(from, to) : Collections.emptyList());
        data.put("total", total);
        return Result.success(data);
    }

    @GetMapping("/exec/screenshot")
    public byte[] screenshot(@RequestParam String executionId, @RequestParam int stepIndex) throws IOException {
        BrowserExecStore exec = execStore.get(executionId);
        if (exec == null) return null;
        for (BrowserStepLogVO log : exec.stepLogs) {
            if (log.getStepIndex() != null && log.getStepIndex() == stepIndex && log.getScreenshotUrl() != null) {
                File file = new File(log.getScreenshotUrl());
                if (file.exists()) {
                    try (FileInputStream fis = new FileInputStream(file)) {
                        byte[] bytes = new byte[(int) file.length()];
                        fis.read(bytes);
                        return bytes;
                    }
                }
            }
        }
        return null;
    }

    // ==================== AI 接口 ====================

    @PostMapping("/ai/generate")
    public Result<?> aiGenerate(@RequestBody Map<String, String> params) {
        if (browserScriptService == null) {
            return Result.error("AI 服务未配置，请在 application.yml 中配置 ai.* 参数");
        }
        try {
            String naturalLang = params.get("naturalLang");
            String targetUrl = params.get("targetUrl");
            List<BrowserAction> actions = browserScriptService.generateScript(naturalLang, targetUrl);
            return Result.success(actions);
        } catch (Exception e) {
            log.error("AI generate failed", e);
            return Result.error("AI 生成失败: " + e.getMessage());
        }
    }

    @PostMapping("/ai/analyze")
    public Result<?> aiAnalyze(@RequestBody Map<String, String> params) {
        if (browserScriptService == null) {
            return Result.error("AI 服务未配置");
        }
        try {
            Map<String, String> result = browserScriptService.analyzeScreenshot(
                    params.get("screenshotBase64"), params.get("taskDescription"));
            return Result.success(result);
        } catch (Exception e) {
            log.error("AI analyze failed", e);
            return Result.error("分析失败: " + e.getMessage());
        }
    }

    // ==================== 定时调度 ====================

    private final ConcurrentHashMap<String, Map<String, Object>> scheduleStore = new ConcurrentHashMap<>();

    @PostMapping("/schedule/save")
    public Result<?> scheduleSave(@RequestBody Map<String, Object> params) {
        String taskCode = (String) params.get("taskCode");
        scheduleStore.put(taskCode, params);
        return Result.success(params);
    }

    @GetMapping("/schedule/get")
    public Result<?> scheduleGet(@RequestParam String taskCode) {
        return Result.success(scheduleStore.getOrDefault(taskCode, null));
    }

    @PostMapping("/schedule/delete")
    public Result<?> scheduleDelete(@RequestBody Map<String, String> params) {
        scheduleStore.remove(params.get("taskCode"));
        return Result.success(null);
    }

    // ==================== 辅助方法 ====================

    private Map<String, Object> toTaskMap(BrowserTaskStore task) {
        Map<String, Object> m = new HashMap<>();
        m.put("taskCode", task.taskCode);
        m.put("taskName", task.taskName);
        m.put("targetUrl", task.targetUrl);
        m.put("description", task.description);
        m.put("stepCount", task.actions.size());
        m.put("createTime", task.createTime);
        m.put("updateTime", task.updateTime);
        // 最近执行状态
        String lastStatus = execStore.values().stream()
                .filter(e -> task.taskCode.equals(e.taskCode))
                .max(Comparator.comparing(e -> e.startTime))
                .map(e -> e.status).orElse(null);
        m.put("lastExecStatus", lastStatus);
        return m;
    }

    private int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(val.toString()); } catch (Exception e) { return 0; }
    }

    // ==================== 内部存储类 ====================

    static class BrowserTaskStore {
        String taskCode;
        String taskName;
        String targetUrl;
        String description;
        List<BrowserAction> actions = new ArrayList<>();
        Date createTime;
        Date updateTime;
    }

    static class BrowserExecStore {
        String executionId;
        String taskCode;
        String taskName;
        String status;
        Date startTime;
        Date endTime;
        Long totalCostMs;
        List<BrowserStepLogVO> stepLogs = new ArrayList<>();
    }
}
