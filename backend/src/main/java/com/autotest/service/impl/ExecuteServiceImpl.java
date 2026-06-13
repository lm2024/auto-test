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
import com.autotest.model.entity.TestChain;
import com.autotest.model.entity.TestExecuteMain;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.entity.TestNodeExecuteLog;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;
import com.autotest.service.ExecuteService;
import com.autotest.util.CodeGenerator;
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
    private javax.sql.DataSource dataSource;

    private final ConcurrentHashMap<String, ExecutionContext> contextMap = new ConcurrentHashMap<>();

    @Override
    public String runChain(String chainCode) {
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
        executeMainMapper.insert(mainLog);

        // Execute asynchronously
        executeChainAsync(executionId, chainCode, chain.getExecuteMode());

        return executionId;
    }

    @Async("executeThreadPool")
    public void executeChainAsync(String executionId, String chainCode, int executeMode) {
        ExecutionContext context = new ExecutionContext();
        context.setExecutionId(executionId);
        context.setChainCode(chainCode);
        context.setStartTime(new Date());
        contextMap.put(executionId, context);

        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        nodes.sort(Comparator.comparing(TestNodeConfig::getSortNo));

        int successCount = 0;
        int failCount = 0;
        int skipCount = 0;
        String errorMessage = null;

        try {
            if (executeMode == 2) {
                // Parallel group mode
                Map<String, List<TestNodeConfig>> groupMap = nodes.stream()
                        .filter(n -> n.getParallelGroup() != null && !n.getParallelGroup().isEmpty())
                        .collect(Collectors.groupingBy(TestNodeConfig::getParallelGroup));

                List<TestNodeConfig> serialNodes = nodes.stream()
                        .filter(n -> n.getParallelGroup() == null || n.getParallelGroup().isEmpty())
                        .collect(Collectors.toList());

                // Execute serial nodes first
                for (TestNodeConfig node : serialNodes) {
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

                // Execute groups in order
                List<Map.Entry<String, List<TestNodeConfig>>> sortedGroups = groupMap.entrySet().stream()
                        .sorted(Comparator.comparing(e -> e.getValue().stream()
                                .mapToInt(TestNodeConfig::getSortNo).min().orElse(0)))
                        .collect(Collectors.toList());

                for (Map.Entry<String, List<TestNodeConfig>> groupEntry : sortedGroups) {
                    if (context.isStopped()) {
                        skipCount += groupEntry.getValue().size();
                        for (TestNodeConfig node : groupEntry.getValue()) {
                            recordSkippedLog(context, node);
                        }
                        continue;
                    }

                    // Execute nodes in group in parallel
                    List<Future<NodeResult>> futures = new ArrayList<>();
                    ExecutorService groupExecutor = Executors.newFixedThreadPool(groupEntry.getValue().size());
                    for (TestNodeConfig node : groupEntry.getValue()) {
                        futures.add(groupExecutor.submit(() -> executeNode(context, node)));
                    }

                    boolean groupFailed = false;
                    for (Future<NodeResult> future : futures) {
                        try {
                            NodeResult result = future.get(120, TimeUnit.SECONDS);
                            if (result.success) {
                                successCount++;
                            } else {
                                failCount++;
                                groupFailed = true;
                                errorMessage = result.errorMessage;
                            }
                        } catch (Exception e) {
                            failCount++;
                            groupFailed = true;
                            errorMessage = e.getMessage();
                        }
                    }
                    groupExecutor.shutdown();

                    if (groupFailed) {
                        context.setStopped(true);
                    }
                    if (!context.isStopped()) {
                        int maxDelay = groupEntry.getValue().stream()
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
                        // Mark remaining nodes as skipped
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
        } catch (Exception e) {
            log.error("Chain execution error: executionId={}", executionId, e);
            errorMessage = e.getMessage();
        }

        // Finalize
        context.setEndTime(new Date());
        long totalCostMs = context.getEndTime().getTime() - context.getStartTime().getTime();
        String finalStatus = failCount > 0 ? "FAILED" : "SUCCESS";

        // Update main log
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

        // Batch insert node logs
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

        // Push chain status
        TestChain chain = chainMapper.selectByChainCode(chainCode);
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

        long startTime = System.currentTimeMillis();

        try {
            // Replace placeholders
            String url = PlaceholderUtil.replace(config.getRequestUrl(), context.getVariables());
            String headers = PlaceholderUtil.replace(config.getRequestHeaders(), context.getVariables());
            String body = PlaceholderUtil.replace(config.getBodyData(), context.getVariables());

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
                    java.io.File uploadFile = findUploadedFile(body);
                    if (uploadFile != null && uploadFile.exists()) {
                        org.apache.http.entity.mime.MultipartEntityBuilder builder = org.apache.http.entity.mime.MultipartEntityBuilder.create();
                        builder.addBinaryBody("file", uploadFile, org.apache.http.entity.ContentType.APPLICATION_OCTET_STREAM, uploadFile.getName());
                        postFile.setEntity(builder.build());
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
                    java.io.File uploadFilePut = findUploadedFile(body);
                    if (uploadFilePut != null && uploadFilePut.exists()) {
                        org.apache.http.entity.mime.MultipartEntityBuilder builder = org.apache.http.entity.mime.MultipartEntityBuilder.create();
                        builder.addBinaryBody("file", uploadFilePut, org.apache.http.entity.ContentType.APPLICATION_OCTET_STREAM, uploadFilePut.getName());
                        putFile.setEntity(builder.build());
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

        nodes.sort(Comparator.comparing(TestNodeConfig::getSortNo));

        ExecutionPlan plan = new ExecutionPlan();
        plan.setExecutionId(CodeGenerator.generateExecutionId());
        plan.setChainCode(chainCode);
        plan.setTotalNodes(nodes.size());

        Map<String, List<TestNodeConfig>> groupMap = nodes.stream()
                .filter(n -> n.getParallelGroup() != null && !n.getParallelGroup().isEmpty())
                .collect(Collectors.groupingBy(TestNodeConfig::getParallelGroup));

        if (groupMap.isEmpty()) {
            ExecutionGroup group = new ExecutionGroup();
            group.setGroupName("");
            group.setGroupSortNo(0);
            List<ExecuteNode> executeNodes = new ArrayList<>();
            for (TestNodeConfig node : nodes) {
                ExecuteNode en = new ExecuteNode();
                en.setConfig(node);
                en.setNodeId(node.getNodeCode());
                executeNodes.add(en);
            }
            group.setNodes(executeNodes);
            plan.getGroups().add(group);
        } else {
            List<Map.Entry<String, List<TestNodeConfig>>> sortedGroups = groupMap.entrySet().stream()
                    .sorted(Comparator.comparing(e -> e.getValue().stream()
                            .mapToInt(TestNodeConfig::getSortNo).min().orElse(0)))
                    .collect(Collectors.toList());

            for (Map.Entry<String, List<TestNodeConfig>> entry : sortedGroups) {
                ExecutionGroup group = new ExecutionGroup();
                group.setGroupName(entry.getKey());
                group.setGroupSortNo(entry.getValue().stream()
                        .mapToInt(TestNodeConfig::getSortNo).min().orElse(0));
                List<ExecuteNode> executeNodes = new ArrayList<>();
                for (TestNodeConfig node : entry.getValue()) {
                    ExecuteNode en = new ExecuteNode();
                    en.setConfig(node);
                    en.setNodeId(node.getNodeCode());
                    executeNodes.add(en);
                }
                group.setNodes(executeNodes);
                plan.getGroups().add(group);
            }
            plan.getGroups().sort(Comparator.comparing(ExecutionGroup::getGroupSortNo));
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
                                                   int pageNo, int pageSize) {
        Date start = null, end = null;
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        try {
            if (startTime != null && !startTime.isEmpty()) start = sdf.parse(startTime);
            if (endTime != null && !endTime.isEmpty()) end = sdf.parse(endTime);
        } catch (Exception e) {
            // Ignore parse errors
        }

        int offset = (pageNo - 1) * pageSize;
        List<TestExecuteMain> records = executeMainMapper.selectList(chainCode, status, start, end, offset, pageSize);
        return records.stream().map(this::buildExecuteMainVO).collect(Collectors.toList());
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

    private java.io.File findUploadedFile(String fileId) {
        java.nio.file.Path dirPath = java.nio.file.Paths.get(System.getProperty("user.dir") + "/uploads");
        java.io.File dir = dirPath.toFile();
        if (!dir.exists()) return null;
        java.io.File[] files = dir.listFiles((d, name) -> name.startsWith(fileId));
        return (files != null && files.length > 0) ? files[0] : null;
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
