package com.autotest.service.impl;

import com.autotest.engine.context.ExecutionContext;
import com.autotest.engine.plan.ExecuteNode;
import com.autotest.engine.plan.ExecutionGroup;
import com.autotest.engine.plan.ExecutionPlan;
import com.autotest.exception.BusinessException;
import com.autotest.mapper.TestChainMapper;
import com.autotest.mapper.TestExecuteMainMapper;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.mapper.TestNodeExecuteLogMapper;
import com.autotest.model.entity.TestAccount;
import com.autotest.model.entity.TestChain;
import com.autotest.model.entity.TestExecuteMain;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.entity.TestNodeExecuteLog;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;
import com.autotest.service.AccountService;
import com.autotest.service.DataPoolService;
import com.autotest.service.ExecuteService;
import com.autotest.service.GlobalVariableService;
import com.autotest.util.CodeGenerator;
import com.autotest.util.DagPlanner;
import com.autotest.util.FileUploadUtil;
import com.autotest.util.PlaceholderUtil;
import com.autotest.websocket.WebSocketPushService;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.alibaba.fastjson.JSONPath;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.*;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
public class ExecuteServiceImpl implements ExecuteService {

    private static final Logger log = LoggerFactory.getLogger(ExecuteServiceImpl.class);

    @Autowired
    private TestChainMapper chainMapper;

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

    @Autowired
    private TestExecuteMainMapper executeMainMapper;

    @Autowired
    private TestNodeExecuteLogMapper nodeExecuteLogMapper;

    @Autowired
    private WebSocketPushService pushService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private GlobalVariableService globalVariableService;

    @Autowired
    private DataPoolService dataPoolService;

    @Autowired
    private javax.sql.DataSource dataSource;

    private final ConcurrentHashMap<String, ExecutionContext> contextMap = new ConcurrentHashMap<>();

    /** 临时存储数据池参数（key: executionId, value: 参数 Map） */
    private final ConcurrentHashMap<String, Map<String, Object>> poolVarsMap = new ConcurrentHashMap<>();

    @Override
    public String runChain(String chainCode) {
        return runChain(chainCode, null, false);
    }

    /**
     * 参数化执行入口。
     * 从数据池取参数注入到执行上下文，支持多轮不同参数。
     *
     * @param chainCode 链路编码
     * @param roundIndex 轮次索引（从 0 开始），-1 表示不使用数据池
     * @param taskExecutionId 关联的定时任务执行 ID（可选）
     */
    public String runChainWithParams(String chainCode, int roundIndex, String taskExecutionId) {
        TestChain chain = chainMapper.selectByChainCode(chainCode);
        if (chain == null) {
            throw new BusinessException(404, "链路不存在");
        }

        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (nodes == null || nodes.isEmpty()) {
            throw new BusinessException(400, "链路无节点配置，无法执行");
        }

        String executionId = CodeGenerator.generateExecutionId();

        // 创建执行记录
        TestExecuteMain mainLog = new TestExecuteMain();
        mainLog.setExecutionId(executionId);
        mainLog.setChainCode(chainCode);
        mainLog.setStatus("RUNNING");
        mainLog.setStartTime(new Date());
        mainLog.setNodeCount(nodes.size());
        mainLog.setSuccessCount(0);
        mainLog.setFailCount(0);
        mainLog.setSkipCount(0);
        mainLog.setTenantId(chain.getTenantId());
        if (roundIndex >= 0) {
            mainLog.setRoundNumber(roundIndex + 1);
        }
        executeMainMapper.insert(mainLog);

        // 异步执行
        executeChainByTraceIdAsync(executionId, chainCode, chain.getExecuteMode(), null, false, roundIndex);

        return executionId;
    }

    /**
     * 带轮次索引的异步执行（内部方法）
     */
    @Async("executeThreadPool")
    public void executeChainByTraceIdAsync(String executionId, String chainCode, int executeMode,
                                           String traceId, boolean parallel, int roundIndex) {
        // 如果需要参数化，预加载数据池参数
        if (roundIndex >= 0) {
            try {
                TestChain chain = chainMapper.selectByChainCode(chainCode);
                if (chain != null && chain.getDataPoolCode() != null && !chain.getDataPoolCode().isEmpty()) {
                    Map<String, Object> poolVars = dataPoolService.getRowVars(chain.getDataPoolCode(), roundIndex);
                    if (poolVars != null && !poolVars.isEmpty()) {
                        poolVarsMap.put(executionId, poolVars);
                    }
                }
            } catch (Exception e) {
                log.warn("[Execute] 加载数据池参数失败: chainCode={}, roundIndex={}", chainCode, roundIndex, e);
            }
        }

        executeChainByTraceIdAsync(executionId, chainCode, executeMode, traceId, parallel);
    }

    /**
     * 按TraceId分组回放链路
     * @param chainCode 链路编码
     * @param traceId 指定的TraceId分组（为null则全部回放）
     * @param parallel 是否并发回放多个TraceGroup
     */
    public String runChain(String chainCode, String traceId, boolean parallel) {
        TestChain chain = chainMapper.selectByChainCode(chainCode);
        if (chain == null) {
            throw new BusinessException(404, "链路不存在");
        }

        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (nodes == null || nodes.isEmpty()) {
            throw new BusinessException(400, "链路无节点配置，无法执行");
        }

        String executionId = CodeGenerator.generateExecutionId();

        // Create execution record
        TestExecuteMain mainLog = new TestExecuteMain();
        mainLog.setExecutionId(executionId);
        mainLog.setChainCode(chainCode);
        mainLog.setStatus("RUNNING");
        mainLog.setStartTime(new Date());
        mainLog.setNodeCount(nodes.size());
        mainLog.setSuccessCount(0);
        mainLog.setFailCount(0);
        mainLog.setSkipCount(0);
        mainLog.setTenantId(chain.getTenantId());
        executeMainMapper.insert(mainLog);

        // Execute asynchronously with TraceId grouping
        executeChainByTraceIdAsync(executionId, chainCode, chain.getExecuteMode(), traceId, parallel);

        return executionId;
    }

    @Async("executeThreadPool")
    public void executeChainAsync(String executionId, String chainCode, int executeMode) {
        executeChainByTraceIdAsync(executionId, chainCode, executeMode, null, false);
    }

    /**
     * 按TraceId分组异步回放链路
     */
    @Async("executeThreadPool")
    public void executeChainByTraceIdAsync(String executionId, String chainCode, int executeMode,
                                           String traceId, boolean parallel) {
        ExecutionContext context = new ExecutionContext();
        context.setExecutionId(executionId);
        context.setChainCode(chainCode);
        context.setStartTime(new Date());
        contextMap.put(executionId, context);

        // 加载全局变量和链路级变量到执行上下文
        try {
            Map<String, String> globalVars = globalVariableService.loadVariableMap(chainCode);
            if (globalVars != null) {
                globalVars.forEach(context::setVariable);
            }
        } catch (Exception e) {
            log.warn("[Execute] 加载全局变量失败: chainCode={}, {}", chainCode, e.getMessage());
        }

        // 注入数据池参数（优先级高于全局变量）
        try {
            Map<String, Object> poolVars = poolVarsMap.remove(executionId);
            if (poolVars != null) {
                poolVars.forEach(context::setVariable);
                log.info("[Execute] 注入数据池参数: executionId={}, count={}", executionId, poolVars.size());
            }
        } catch (Exception e) {
            log.warn("[Execute] 注入数据池参数失败: executionId={}", executionId, e);
        }

        TestChain chain = chainMapper.selectByChainCode(chainCode);

        // 执行前置登录链路（如果有）
        executeLoginChain(chain, context);

        List<TestNodeConfig> allNodes = nodeConfigMapper.selectByChainCode(chainCode);

        // 执行顺序由 X6 画布拓扑决定，不再依赖 sort_no / parallel_group
        List<List<TestNodeConfig>> dagLayers = new ArrayList<>();
        String planError = null;
        try {
            dagLayers = DagPlanner.planLayers(chain.getGraphData(), allNodes);
        } catch (Exception e) {
            planError = e.getMessage();
            log.error("[Execute] 链路拓扑解析失败: chainCode={}", chainCode, e);
        }
        List<TestNodeConfig> nodes = new ArrayList<>();
        for (List<TestNodeConfig> layer : dagLayers) {
            nodes.addAll(layer);
        }
        if (planError != null) {
            nodes = allNodes;
        }

        int successCount = 0;
        int failCount = 0;
        int skipCount = 0;
        String errorMessage = null;

        try {
            // 画布拓扑非法（例如存在环形依赖）时直接判失败，不执行任何节点
            if (planError != null) {
                throw new BusinessException(400, planError);
            }

            // Phase 2: Account acquisition and token injection
            String acquiredAccountCode = null;
            if (chain.getAccountCode() != null && !chain.getAccountCode().isEmpty()) {
                try {
                    TestAccount account = accountService.acquireAccount(chain.getAccountCode());
                    acquiredAccountCode = account.getAccountCode();
                    String token = obtainTokenForAccount(account);
                    if (token != null) {
                        context.setVariable("__ACCOUNT_TOKEN__", token);
                    }
                    log.info("[Execute] 获取测试账号成功: {}", account.getAccountCode());
                } catch (Exception e) {
                    log.warn("[Execute] 获取测试账号失败: {}, 继续执行", chain.getAccountCode(), e);
                }
            }

            // Group nodes by bizOperTraceId
            Map<String, List<TestNodeConfig>> traceGroups = nodes.stream()
                    .filter(n -> n.getBizOperTraceId() != null && !n.getBizOperTraceId().isEmpty())
                    .collect(Collectors.groupingBy(
                        TestNodeConfig::getBizOperTraceId,
                        LinkedHashMap::new,
                        Collectors.toList()
                    ));

            // Ungrouped nodes
            List<TestNodeConfig> ungroupedNodes = nodes.stream()
                    .filter(n -> n.getBizOperTraceId() == null || n.getBizOperTraceId().isEmpty())
                    .collect(Collectors.toList());

            // If specific traceId requested, filter to that group only
            if (traceId != null && !traceId.isEmpty()) {
                Map<String, List<TestNodeConfig>> filtered = new LinkedHashMap<>();
                if (traceGroups.containsKey(traceId)) {
                    filtered.put(traceId, traceGroups.get(traceId));
                }
                traceGroups = filtered;
                ungroupedNodes = new ArrayList<>();
            }

            if (traceGroups.isEmpty()) {
                // No trace groups - execute in original mode
                if (parallel) {
                    // Parallel execution of all groups
                    List<Future<Map<String, Object>>> futures = new ArrayList<>();
                    ExecutorService groupExecutor = Executors.newFixedThreadPool(
                            Math.max(1, traceGroups.size() + (ungroupedNodes.isEmpty() ? 0 : 1)));

                    for (Map.Entry<String, List<TestNodeConfig>> entry : traceGroups.entrySet()) {
                        String tid = entry.getKey();
                        List<TestNodeConfig> groupNodes = entry.getValue();
                        futures.add(groupExecutor.submit(() -> {
                            ExecutionContext groupContext = new ExecutionContext();
                            groupContext.setExecutionId(executionId + "_" + tid);
                            groupContext.setChainCode(chainCode);
                            groupContext.setStartTime(new Date());

                            Map<String, Object> groupResult = new HashMap<>();
                            groupResult.put("traceId", tid);
                            groupResult.put("success", 0);
                            groupResult.put("fail", 0);

                            for (TestNodeConfig node : groupNodes) {
                                NodeResult result = executeNode(groupContext, node);
                                if (result.success) {
                                    groupResult.put("success", (int) groupResult.get("success") + 1);
                                } else {
                                    groupResult.put("fail", (int) groupResult.get("fail") + 1);
                                }
                            }
                            return groupResult;
                        }));
                    }

                    for (Future<Map<String, Object>> future : futures) {
                        try {
                            Map<String, Object> result = future.get(300, TimeUnit.SECONDS);
                            successCount += (int) result.get("success");
                            failCount += (int) result.get("fail");
                        } catch (Exception e) {
                            failCount++;
                            errorMessage = e.getMessage();
                        }
                    }
                    groupExecutor.shutdown();
                } else {
                    // Serial execution - process each trace group in order
                    for (Map.Entry<String, List<TestNodeConfig>> entry : traceGroups.entrySet()) {
                        String tid = entry.getKey();
                        List<TestNodeConfig> groupNodes = entry.getValue();

                        if (context.isStopped()) {
                            skipCount += groupNodes.size();
                            for (TestNodeConfig node : groupNodes) {
                                recordSkippedLog(context, node);
                            }
                            continue;
                        }

                        for (TestNodeConfig node : groupNodes) {
                            if (context.isStopped()) {
                                skipCount++;
                                recordSkippedLog(context, node);
                                continue;
                            }

                            NodeResult result = executeNode(context, node);
                            if (result.success) {
                                successCount++;
                            } else {
                                failCount++;
                                context.setStopped(true);
                                errorMessage = result.errorMessage;
                            }

                            if (!context.isStopped() && node.getDelaySeconds() != null && node.getDelaySeconds() > 0) {
                                try { Thread.sleep(node.getDelaySeconds() * 1000L); } catch (InterruptedException ignored) {}
                            }
                        }
                    }
                }

                // Execute ungrouped nodes
                if (!ungroupedNodes.isEmpty() && !context.isStopped()) {
                    for (TestNodeConfig node : ungroupedNodes) {
                        if (context.isStopped()) {
                            skipCount++;
                            recordSkippedLog(context, node);
                            continue;
                        }
                        NodeResult result = executeNode(context, node);
                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                            context.setStopped(true);
                            errorMessage = result.errorMessage;
                        }
                        if (!context.isStopped() && node.getDelaySeconds() != null && node.getDelaySeconds() > 0) {
                            try { Thread.sleep(node.getDelaySeconds() * 1000L); } catch (InterruptedException ignored) {}
                        }
                    }
                }
            } else {
                // Has trace groups - use original executeMode logic
                if (executeMode == 2) {
                    // 并发模式：按 X6 画布 DAG 分层，层内并发、层间串行
                    for (List<TestNodeConfig> layer : dagLayers) {
                        if (context.isStopped()) {
                            skipCount += layer.size();
                            for (TestNodeConfig node : layer) {
                                recordSkippedLog(context, node);
                            }
                            continue;
                        }

                        // 单节点层无需起线程池
                        if (layer.size() == 1) {
                            TestNodeConfig node = layer.get(0);
                            NodeResult result = executeNode(context, node);
                            if (result.success) {
                                successCount++;
                            } else {
                                failCount++;
                                context.setStopped(true);
                                errorMessage = result.errorMessage;
                            }
                            if (!context.isStopped() && node.getDelaySeconds() != null && node.getDelaySeconds() > 0) {
                                try { Thread.sleep(node.getDelaySeconds() * 1000L); } catch (InterruptedException ignored) {}
                            }
                            continue;
                        }

                        List<Future<NodeResult>> futures = new ArrayList<>();
                        ExecutorService layerExecutor = Executors.newFixedThreadPool(layer.size());
                        for (TestNodeConfig node : layer) {
                            futures.add(layerExecutor.submit(() -> executeNode(context, node)));
                        }

                        boolean layerFailed = false;
                        for (Future<NodeResult> future : futures) {
                            try {
                                NodeResult result = future.get(120, TimeUnit.SECONDS);
                                if (result.success) {
                                    successCount++;
                                } else {
                                    failCount++;
                                    layerFailed = true;
                                    errorMessage = result.errorMessage;
                                }
                            } catch (Exception e) {
                                failCount++;
                                layerFailed = true;
                                errorMessage = e.getMessage();
                            }
                        }
                        layerExecutor.shutdown();

                        if (layerFailed) {
                            context.setStopped(true);
                        }
                        if (!context.isStopped()) {
                            int maxDelay = layer.stream()
                                    .mapToInt(n -> n.getDelaySeconds() != null ? n.getDelaySeconds() : 0)
                                    .max().orElse(0);
                            if (maxDelay > 0) {
                                try { Thread.sleep(maxDelay * 1000L); } catch (InterruptedException ignored) {}
                            }
                        }
                    }
                } else {
                    // Serial mode
                    for (TestNodeConfig node : nodes) {
                        if (context.isStopped()) {
                            skipCount++;
                            recordSkippedLog(context, node);
                            continue;
                        }
                        NodeResult result = executeNode(context, node);
                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                            context.setStopped(true);
                            errorMessage = result.errorMessage;
                            int nodeIndex = nodes.indexOf(node);
                            skipCount += nodes.size() - nodeIndex - 1;
                            for (int i = nodeIndex + 1; i < nodes.size(); i++) {
                                recordSkippedLog(context, nodes.get(i));
                            }
                            break;
                        }
                        if (node.getDelaySeconds() != null && node.getDelaySeconds() > 0) {
                            try { Thread.sleep(node.getDelaySeconds() * 1000L); } catch (InterruptedException ignored) {}
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Chain execution error: executionId={}", executionId, e);
            errorMessage = e.getMessage();
        } finally {
            // Phase 2: Release account lock
            if (chain.getAccountCode() != null && !chain.getAccountCode().isEmpty()) {
                try {
                    accountService.releaseAccount(chain.getAccountCode());
                    log.info("[Execute] 释放测试账号: {}", chain.getAccountCode());
                } catch (Exception e) {
                    log.warn("[Execute] 释放测试账号失败: {}", chain.getAccountCode(), e);
                }
            }
        }

        // Finalize
        context.setEndTime(new Date());
        long totalCostMs = context.getEndTime().getTime() - context.getStartTime().getTime();
        String finalStatus = (failCount > 0 || errorMessage != null) ? "FAILED" : "SUCCESS";

        TestExecuteMain updateLog = new TestExecuteMain();
        updateLog.setExecutionId(executionId);
        updateLog.setStatus(finalStatus);
        updateLog.setEndTime(context.getEndTime());
        updateLog.setTotalCostMs(totalCostMs);
        updateLog.setSuccessCount(successCount);
        updateLog.setFailCount(failCount);
        updateLog.setSkipCount(skipCount);
        if (errorMessage != null) {
            updateLog.setErrorMessage(errorMessage.length() > 2000 ? errorMessage.substring(0, 2000) : errorMessage);
        }
        executeMainMapper.update(updateLog);

        List<TestNodeExecuteLog> nodeLogs = context.getNodeLogs();
        if (!nodeLogs.isEmpty()) {
            try {
                int batchSize = 100;
                for (int i = 0; i < nodeLogs.size(); i += batchSize) {
                    int end = Math.min(i + batchSize, nodeLogs.size());
                    List<TestNodeExecuteLog> batch = nodeLogs.subList(i, end);
                    nodeExecuteLogMapper.batchInsert(batch);
                }
            } catch (Exception e) {
                log.error("Failed to batch insert node logs: executionId={}", executionId, e);
            }
        }

        pushService.pushChainStatus(executionId, chainCode, finalStatus, totalCostMs,
                nodes.size(), successCount, failCount, skipCount, errorMessage);

        contextMap.remove(executionId);
    }

    private NodeResult executeNode(ExecutionContext context, TestNodeConfig config) {
        // Push running status
        pushService.pushNodeStatus(context.getExecutionId(), config.getNodeCode(),
                config.getNodeName(), "RUNNING", 0, null, null);

        TestNodeExecuteLog logEntry = new TestNodeExecuteLog();
        logEntry.setExecutionId(context.getExecutionId());
        logEntry.setNodeCode(config.getNodeCode());
        logEntry.setNodeName(config.getNodeName());
        logEntry.setStatus("RUNNING");
        logEntry.setRequestUrl(config.getRequestUrl());
        logEntry.setRequestMethod(config.getRequestMethod());
        logEntry.setStartTime(new Date());
        logEntry.setBizOperTraceId(config.getBizOperTraceId());
        logEntry.setSortNo(Integer.valueOf(context.nextExecuteSeq()));

        long startTime = System.currentTimeMillis();

        try {
            // Replace placeholders
            String url = PlaceholderUtil.replace(config.getRequestUrl(), context.getVariables());
            String headers = PlaceholderUtil.replace(config.getRequestHeaders(), context.getVariables());
            String body = PlaceholderUtil.replace(config.getBodyData(), context.getVariables());

            // Phase 2: Auto-inject account token if bound
            if (context.getVariable("__ACCOUNT_TOKEN__") != null) {
                String token = String.valueOf(context.getVariable("__ACCOUNT_TOKEN__"));
                if (headers == null || headers.isEmpty() || !headers.contains("Authorization")) {
                    if (headers == null || headers.isEmpty()) {
                        headers = "{\"Authorization\":\"Bearer " + token + "\"}";
                    } else {
                        try {
                            JSONObject h = JSON.parseObject(headers);
                            h.put("Authorization", "Bearer " + token);
                            headers = h.toJSONString();
                        } catch (Exception ignored) {}
                    }
                }
            }

            logEntry.setRequestUrl(url);
            logEntry.setRequestHeaders(headers);
            logEntry.setRequestBody(body);

            // Execute HTTP request
            String bodyType = config.getBodyType() != null ? config.getBodyType() : "json";
            HttpClientResult httpResult = executeHttpRequest(config.getRequestMethod(), url, headers, body, bodyType, config.getBodyData());

            long costMs = System.currentTimeMillis() - startTime;
            logEntry.setResponseCode(httpResult.statusCode);
            logEntry.setResponseHeaders(httpResult.headers);
            logEntry.setResponseBody(httpResult.body);
            logEntry.setCostMs(costMs);
            logEntry.setEndTime(new Date());

            // Check assert rules
            boolean assertPassed = validateAssertions(config.getAssertRules(), httpResult);

            if (httpResult.statusCode >= 200 && httpResult.statusCode < 300 && assertPassed) {
                logEntry.setStatus("SUCCESS");

                // Extract variables
                extractVariables(config.getExtractRules(), httpResult.body, context);

                pushService.pushNodeStatus(context.getExecutionId(), config.getNodeCode(),
                        config.getNodeName(), "SUCCESS", costMs, httpResult.statusCode, null);

                context.addNodeLog(logEntry);
                return new NodeResult(true, null);
            } else {
                String errMsg = "断言失败: 响应码=" + httpResult.statusCode;
                if (!assertPassed) errMsg += ", 断言规则不通过";
                logEntry.setStatus("FAILED");
                logEntry.setErrorMessage(errMsg);

                pushService.pushNodeStatus(context.getExecutionId(), config.getNodeCode(),
                        config.getNodeName(), "FAILED", costMs, httpResult.statusCode, errMsg);

                context.addNodeLog(logEntry);
                return new NodeResult(false, errMsg);
            }
        } catch (Exception e) {
            long costMs = System.currentTimeMillis() - startTime;
            logEntry.setStatus("FAILED");
            logEntry.setCostMs(costMs);
            logEntry.setEndTime(new Date());
            logEntry.setErrorMessage(e.getMessage());

            pushService.pushNodeStatus(context.getExecutionId(), config.getNodeCode(),
                    config.getNodeName(), "FAILED", costMs, null, e.getMessage());

            context.addNodeLog(logEntry);
            return new NodeResult(false, e.getMessage());
        }
    }

    private void recordSkippedLog(ExecutionContext context, TestNodeConfig config) {
        TestNodeExecuteLog logEntry = new TestNodeExecuteLog();
        logEntry.setExecutionId(context.getExecutionId());
        logEntry.setNodeCode(config.getNodeCode());
        logEntry.setNodeName(config.getNodeName());
        logEntry.setStatus("SKIPPED");
        logEntry.setStartTime(new Date());
        logEntry.setEndTime(new Date());
        context.addNodeLog(logEntry);

        pushService.pushNodeStatus(context.getExecutionId(), config.getNodeCode(),
                config.getNodeName(), "SKIPPED", 0, null, null);
    }

    private HttpClientResult executeHttpRequest(String method, String url, String headersJson, String body) throws Exception {
        return executeHttpRequest(method, url, headersJson, body, "json", null);
    }

    private HttpClientResult executeHttpRequest(String method, String url, String headersJson, String body, String bodyType, String originalBodyData) throws Exception {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(10000)
                .setSocketTimeout(120000)
                .setConnectionRequestTimeout(5000)
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setDefaultRequestConfig(requestConfig)
                .disableRedirectHandling()
                .build();

        HttpRequestBase request;
        boolean isFileUpload = "file".equals(bodyType) && body != null && body.startsWith("FILE_");

        switch (method.toUpperCase()) {
            case "POST":
                if (isFileUpload) {
                    HttpPost postFile = new HttpPost(url);
                    org.apache.http.HttpEntity fileEntity = FileUploadUtil.buildFileMultipartEntity(body);
                    if (fileEntity != null) {
                        postFile.setEntity(fileEntity);
                    }
                    request = postFile;
                } else {
                    HttpPost post = new HttpPost(url);
                    if (body != null && !body.isEmpty()) {
                        post.setEntity(new StringEntity(body, "UTF-8"));
                    }
                    request = post;
                }
                break;
            case "PUT":
                if (isFileUpload) {
                    HttpPut putFile = new HttpPut(url);
                    org.apache.http.HttpEntity fileEntityPut = FileUploadUtil.buildFileMultipartEntity(body);
                    if (fileEntityPut != null) {
                        putFile.setEntity(fileEntityPut);
                    }
                    request = putFile;
                } else {
                    HttpPut put = new HttpPut(url);
                    if (body != null && !body.isEmpty()) {
                        put.setEntity(new StringEntity(body, "UTF-8"));
                    }
                    request = put;
                }
                break;
            case "DELETE":
                request = new HttpDelete(url);
                break;
            case "GET":
            default:
                request = new HttpGet(url);
                break;
        }

        // Set headers
        if (headersJson != null && !headersJson.isEmpty()) {
            try {
                JSONObject headers = JSON.parseObject(headersJson);
                for (String key : headers.keySet()) {
                    request.setHeader(key, headers.getString(key));
                }
            } catch (Exception e) {
                // Ignore invalid headers
            }
        }

        if (!isFileUpload && request.getFirstHeader("Content-Type") == null && body != null) {
            request.setHeader("Content-Type", "application/json");
        }

        try (CloseableHttpResponse response = httpClient.execute(request)) {
            String responseStr = EntityUtils.toString(response.getEntity(), "UTF-8");
            String responseHeaders = "";
            org.apache.http.Header[] respHeaders = response.getAllHeaders();
            StringBuilder headerBuilder = new StringBuilder("{");
            for (int i = 0; i < respHeaders.length; i++) {
                if (i > 0) headerBuilder.append(",");
                headerBuilder.append("\"").append(respHeaders[i].getName()).append("\":\"")
                        .append(respHeaders[i].getValue()).append("\"");
            }
            headerBuilder.append("}");
            responseHeaders = headerBuilder.toString();

            return new HttpClientResult(response.getStatusLine().getStatusCode(), responseHeaders, responseStr);
        }
    }

    private boolean validateAssertions(String assertRulesJson, HttpClientResult result) {
        if (assertRulesJson == null || assertRulesJson.isEmpty()) {
            return true;
        }
        try {
            JSONObject rules = JSON.parseObject(assertRulesJson);
            // Check response code assertion
            if (rules.containsKey("statusCode")) {
                int expectedCode = rules.getIntValue("statusCode");
                if (result.statusCode != expectedCode) {
                    return false;
                }
            }
            // Check body assertions
            if (rules.containsKey("body")) {
                JSONObject bodyRules = rules.getJSONObject("body");
                JSONObject responseBody = JSON.parseObject(result.body);
                for (String path : bodyRules.keySet()) {
                    Object expected = bodyRules.get(path);
                    Object actual = JSONPath.eval(responseBody, path);
                    if (!String.valueOf(expected).equals(String.valueOf(actual))) {
                        return false;
                    }
                }
            }
            return true;
        } catch (Exception e) {
            log.warn("Failed to validate assertions: {}", e.getMessage());
            return true;
        }
    }

    private void extractVariables(String extractRulesJson, String responseBody, ExecutionContext context) {
        if (extractRulesJson == null || extractRulesJson.isEmpty() || responseBody == null) {
            return;
        }
        try {
            JSONObject rules = JSON.parseObject(extractRulesJson);
            com.alibaba.fastjson.JSONArray rulesArray = rules.getJSONArray("rules");
            if (rulesArray == null) return;

            JSONObject responseObj = JSON.parseObject(responseBody);
            for (int i = 0; i < rulesArray.size(); i++) {
                JSONObject rule = rulesArray.getJSONObject(i);
                String varName = rule.getString("varName");
                String jsonPath = rule.getString("jsonPath");
                Object value = JSONPath.eval(responseObj, jsonPath);
                if (value != null) {
                    context.setVariable(varName, value);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to extract variables: {}", e.getMessage());
        }
    }

    @Override
    public ExecutionPlan parseChain(String chainCode) {
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (nodes == null || nodes.isEmpty()) {
            throw new BusinessException(400, "链路无节点配置");
        }

        TestChain chain = chainMapper.selectByChainCode(chainCode);
        String graphData = chain != null ? chain.getGraphData() : null;

        ExecutionPlan plan = new ExecutionPlan();
        plan.setExecutionId(CodeGenerator.generateExecutionId());
        plan.setChainCode(chainCode);
        plan.setTotalNodes(nodes.size());

        // 每一层 = 一个执行组，层内节点可并发
        List<List<TestNodeConfig>> layers = DagPlanner.planLayers(graphData, nodes);
        int layerIndex = 0;
        for (List<TestNodeConfig> layer : layers) {
            ExecutionGroup group = new ExecutionGroup();
            group.setGroupName("L" + layerIndex);
            group.setGroupSortNo(layerIndex);
            List<ExecuteNode> executeNodes = new ArrayList<>();
            for (TestNodeConfig node : layer) {
                ExecuteNode en = new ExecuteNode();
                en.setConfig(node);
                en.setNodeId(node.getNodeCode());
                executeNodes.add(en);
            }
            group.setNodes(executeNodes);
            plan.getGroups().add(group);
            layerIndex++;
        }

        return plan;
    }

    @Override
    public ExecuteMainVO getExecuteStatus(String executionId) {
        TestExecuteMain main = executeMainMapper.selectByExecutionId(executionId);
        if (main == null) {
            throw new BusinessException(404, "执行记录不存在");
        }
        return buildExecuteMainVO(main);
    }

    @Override
    public List<NodeExecuteLogVO> getNodeLogs(String executionId) {
        List<TestNodeExecuteLog> logs = nodeExecuteLogMapper.selectByExecutionId(executionId);
        return logs.stream().map(this::buildNodeExecuteLogVO).collect(Collectors.toList());
    }

    @Override
    public List<ExecuteMainVO> listExecuteRecords(String chainCode, String status,
                                                   String startTime, String endTime,
                                                   List<Long> categoryIds, int pageNo, int pageSize) {
        Date start = null, end = null;
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        try {
            if (startTime != null && !startTime.isEmpty()) start = sdf.parse(startTime);
            if (endTime != null && !endTime.isEmpty()) end = sdf.parse(endTime);
        } catch (Exception e) {
            // Ignore parse errors
        }

        int offset = (pageNo - 1) * pageSize;
        List<TestExecuteMain> records;
        if (categoryIds != null && !categoryIds.isEmpty()) {
            records = executeMainMapper.selectListByCategory(chainCode, status, start, end, categoryIds, offset, pageSize);
        } else {
            records = executeMainMapper.selectList(chainCode, status, start, end, offset, pageSize);
        }
        return records.stream().map(this::buildExecuteMainVO).collect(Collectors.toList());
    }

    @Override
    public int countExecuteRecords(String chainCode, String status, String startTime, String endTime, List<Long> categoryIds) {
        Date start = null, end = null;
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        try {
            if (startTime != null && !startTime.isEmpty()) start = sdf.parse(startTime);
            if (endTime != null && !endTime.isEmpty()) end = sdf.parse(endTime);
        } catch (Exception e) {
            // Ignore parse errors
        }
        if (categoryIds != null && !categoryIds.isEmpty()) {
            return executeMainMapper.countListByCategory(chainCode, status, start, end, categoryIds);
        }
        return executeMainMapper.countList(chainCode, status, start, end);
    }

    private ExecuteMainVO buildExecuteMainVO(TestExecuteMain main) {
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

        // Get chain name
        TestChain chain = chainMapper.selectByChainCode(main.getChainCode());
        if (chain != null) {
            vo.setChainName(chain.getChainName());
        }
        return vo;
    }

    private NodeExecuteLogVO buildNodeExecuteLogVO(TestNodeExecuteLog log) {
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
        vo.setExtractedVars(log.getExtractedVars());
        vo.setStartTime(log.getStartTime());
        vo.setEndTime(log.getEndTime());
        return vo;
    }

    /**
     * Phase 2: 根据账号认证类型获取token
     */
    private String obtainTokenForAccount(TestAccount account) {
        if (account == null || account.getAuthConfig() == null) {
            return null;
        }
        try {
            JSONObject config = JSON.parseObject(account.getAuthConfig());
            String authType = account.getAuthType();

            if ("TOKEN".equals(authType)) {
                return config.getString("token");
            }

            if ("PASSWORD".equals(authType)) {
                String loginUrl = config.getString("loginUrl");
                if (loginUrl == null || loginUrl.isEmpty()) return null;

                JSONObject loginBody = new JSONObject();
                String usernameField = config.getString("usernameField");
                String passwordField = config.getString("passwordField");
                if (usernameField == null) usernameField = "username";
                if (passwordField == null) passwordField = "password";
                loginBody.put(usernameField, account.getUsername());
                loginBody.put(passwordField, account.getPassword());

                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig).build()) {
                    HttpPost post = new HttpPost(loginUrl);
                    post.setHeader("Content-Type", "application/json");
                    post.setEntity(new StringEntity(loginBody.toJSONString(), "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        JSONObject respJson = JSON.parseObject(respBody);
                        String tokenField = config.getString("tokenField");
                        if (tokenField == null) tokenField = "token";
                        return respJson.getString(tokenField);
                    }
                }
            }

            if ("SSO".equals(authType)) {
                String tokenUrl = config.getString("tokenUrl");
                if (tokenUrl == null || tokenUrl.isEmpty()) return null;

                String clientId = config.getString("clientId");
                String clientSecret = config.getString("clientSecret");
                String grantType = config.getString("grantType");
                if (grantType == null) grantType = "client_credentials";

                RequestConfig requestConfig = RequestConfig.custom()
                        .setConnectTimeout(10000).setSocketTimeout(30000).build();
                try (CloseableHttpClient client = HttpClients.custom()
                        .setDefaultRequestConfig(requestConfig).build()) {
                    HttpPost post = new HttpPost(tokenUrl);
                    post.setHeader("Content-Type", "application/x-www-form-urlencoded");
                    String formBody = "grant_type=" + grantType
                            + "&client_id=" + clientId
                            + "&client_secret=" + clientSecret;
                    post.setEntity(new StringEntity(formBody, "UTF-8"));
                    try (CloseableHttpResponse response = client.execute(post)) {
                        String respBody = EntityUtils.toString(response.getEntity(), "UTF-8");
                        JSONObject respJson = JSON.parseObject(respBody);
                        return respJson.getString("access_token");
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Execute] 获取账号token失败: accountCode={}", account.getAccountCode(), e);
        }
        return null;
    }

    /**
     * 执行前置登录链路。
     * 如果链路配置了 login_chain_code，则先同步执行登录链路，
     * 将登录链路提取的变量（token、cookie 等）注入到当前执行上下文。
     */
    private void executeLoginChain(TestChain chain, ExecutionContext context) {
        if (chain == null) {
            return;
        }
        String loginChainCode = chain.getLoginChainCode();
        if (loginChainCode == null || loginChainCode.trim().isEmpty()) {
            return;
        }

        log.info("[Execute] 执行前置登录链路: loginChainCode={}", loginChainCode);
        try {
            // 同步执行登录链路
            ExecutionContext loginContext = executeChainSync(loginChainCode);

            // 将登录链路的变量合并到当前上下文
            if (loginContext != null && loginContext.getVariables() != null) {
                Map<String, Object> loginVars = loginContext.getVariables();
                for (Map.Entry<String, Object> entry : loginVars.entrySet()) {
                    // 不覆盖已有的 __ACCOUNT_TOKEN__
                    if ("__ACCOUNT_TOKEN__".equals(entry.getKey())
                            && context.getVariable("__ACCOUNT_TOKEN__") != null) {
                        continue;
                    }
                    context.setVariable(entry.getKey(), entry.getValue());
                }
                log.info("[Execute] 登录链路变量注入成功: count={}", loginVars.size());
            }
        } catch (Exception e) {
            log.error("[Execute] 前置登录链路执行失败: loginChainCode={}", loginChainCode, e);
            // 登录失败不中断业务链路执行，只记录警告
            log.warn("[Execute] 登录链路执行失败，继续执行业务链路（可能因缺少认证而失败）");
        }
    }

    /**
     * 同步执行一条链路并返回执行上下文。
     * 用于登录链路的前置执行。
     */
    private ExecutionContext executeChainSync(String chainCode) {
        TestChain loginChain = chainMapper.selectByChainCode(chainCode);
        if (loginChain == null) {
            throw new BusinessException(404, "登录链路不存在: " + chainCode);
        }

        List<TestNodeConfig> allNodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (allNodes == null || allNodes.isEmpty()) {
            throw new BusinessException(400, "登录链路无节点: " + chainCode);
        }

        ExecutionContext loginContext = new ExecutionContext();
        loginContext.setExecutionId("LOGIN_" + CodeGenerator.generateExecutionId());
        loginContext.setChainCode(chainCode);
        loginContext.setStartTime(new Date());

        // 加载全局变量
        try {
            Map<String, String> globalVars = globalVariableService.loadVariableMap(chainCode);
            if (globalVars != null) {
                globalVars.forEach(loginContext::setVariable);
            }
        } catch (Exception e) {
            log.warn("[Execute] 登录链路加载全局变量失败: {}", e.getMessage());
        }

        // DAG 规划
        List<List<TestNodeConfig>> dagLayers = new ArrayList<>();
        try {
            dagLayers = DagPlanner.planLayers(loginChain.getGraphData(), allNodes);
        } catch (Exception e) {
            log.error("[Execute] 登录链路拓扑解析失败: chainCode={}", chainCode, e);
        }
        List<TestNodeConfig> nodes = new ArrayList<>();
        for (List<TestNodeConfig> layer : dagLayers) {
            nodes.addAll(layer);
        }
        if (nodes.isEmpty()) {
            nodes = allNodes;
        }

        // 获取账号 token
        if (loginChain.getAccountCode() != null && !loginChain.getAccountCode().isEmpty()) {
            try {
                TestAccount account = accountService.acquireAccount(loginChain.getAccountCode());
                String token = obtainTokenForAccount(account);
                if (token != null) {
                    loginContext.setVariable("__ACCOUNT_TOKEN__", token);
                }
            } catch (Exception e) {
                log.warn("[Execute] 登录链路获取账号失败: {}", e.getMessage());
            }
        }

        // 串行执行所有节点
        for (TestNodeConfig node : nodes) {
            if (loginContext.isStopped()) {
                break;
            }
            NodeResult result = executeNode(loginContext, node);
            if (!result.success) {
                log.error("[Execute] 登录链路节点执行失败: nodeCode={}, error={}",
                        node.getNodeCode(), result.errorMessage);
                break;
            }
        }

        // 释放账号
        if (loginChain.getAccountCode() != null && !loginChain.getAccountCode().isEmpty()) {
            try {
                accountService.releaseAccount(loginChain.getAccountCode());
            } catch (Exception e) {
                log.warn("[Execute] 登录链路释放账号失败: {}", e.getMessage());
            }
        }

        return loginContext;
    }

    private static class NodeResult {
        boolean success;
        String errorMessage;
        NodeResult(boolean success, String errorMessage) {
            this.success = success;
            this.errorMessage = errorMessage;
        }
    }

    private static class HttpClientResult {
        int statusCode;
        String headers;
        String body;
        HttpClientResult(int statusCode, String headers, String body) {
            this.statusCode = statusCode;
            this.headers = headers;
            this.body = body;
        }
    }
}
