package com.autotest.service.impl;

import com.autotest.config.AiConfig;
import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysConfigMapper;
import com.autotest.mapper.TestChainMapper;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.mapper.TestNodeExecuteLogMapper;
import com.autotest.model.entity.TestChain;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.entity.TestNodeExecuteLog;
import com.autotest.model.dto.FailureAnalyzeDTO;
import com.autotest.model.dto.TestDataGenerateDTO;
import com.autotest.service.AiService;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

@Service
public class AiServiceImpl implements AiService {

    private static final Logger log = LoggerFactory.getLogger(AiServiceImpl.class);

    @Autowired
    private AiConfig aiConfig;

    @Autowired
    private SysConfigMapper sysConfigMapper;

    @Autowired
    private TestChainMapper chainMapper;

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

    @Autowired
    private TestNodeExecuteLogMapper nodeExecuteLogMapper;

    @Override
    public Map<String, Object> generateTestData(TestDataGenerateDTO dto) {
        // Validate chain has nodes
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(dto.getChainCode());
        if (nodes == null || nodes.isEmpty()) {
            throw new BusinessException(400, "链路无节点配置，无法生成测试数据");
        }

        // Try AI model, fallback to mock if unavailable
        String aiResponse = null;
        try {
            String systemPrompt = buildGenerateSystemPrompt(dto);
            String userPrompt = buildGenerateUserPrompt(dto.getChainCode(), nodes);
            aiResponse = callModel(systemPrompt, userPrompt);
        } catch (Exception e) {
            log.warn("AI model unavailable, using mock data: {}", e.getMessage());
        }

        Map<String, Object> nodeData;
        if (aiResponse != null && !aiResponse.trim().isEmpty()) {
            nodeData = parseGenerateResponse(aiResponse, nodes);
        } else {
            nodeData = generateMockData(nodes);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodeData", nodeData);
        result.put("message", aiResponse != null ? "测试数据生成成功" : "AI模型未连接，已生成模拟测试数据");
        return result;
    }

    @Override
    public Map<String, String> analyzeFailure(FailureAnalyzeDTO dto) {
        // Get execution log
        TestNodeExecuteLog logEntry = nodeExecuteLogMapper.selectByExecutionAndNode(
                dto.getExecutionId(), dto.getNodeCode());
        if (logEntry == null) {
            throw new BusinessException(404, "节点执行日志不存在");
        }

        // Try AI model first, fallback to rule-based analysis
        String aiResponse = null;
        try {
            String systemPrompt = buildAnalyzeSystemPrompt();
            String userPrompt = buildAnalyzeUserPrompt(logEntry);
            aiResponse = callModel(systemPrompt, userPrompt);
        } catch (Exception e) {
            log.warn("AI model unavailable for failure analysis: {}", e.getMessage());
        }

        if (aiResponse != null && !aiResponse.trim().isEmpty()) {
            Map<String, String> result = parseAnalyzeResponse(aiResponse);
            result.put("source", "AI智能分析");
            return result;
        } else {
            Map<String, String> result = generateMockAnalysis(logEntry);
            result.put("source", "规则分析");
            return result;
        }
    }

    private Map<String, String> generateMockAnalysis(TestNodeExecuteLog logEntry) {
        Map<String, String> analysis = new HashMap<>();
        String url = logEntry.getRequestUrl() != null ? logEntry.getRequestUrl() : "";
        String method = logEntry.getRequestMethod() != null ? logEntry.getRequestMethod() : "";
        Integer responseCode = logEntry.getResponseCode();
        String errorMsg = logEntry.getErrorMessage();
        String requestBody = logEntry.getRequestBody();
        String responseBody = logEntry.getResponseBody();

        StringBuilder rootCause = new StringBuilder();
        StringBuilder steps = new StringBuilder();
        StringBuilder fix = new StringBuilder();

        rootCause.append("【节点】").append(logEntry.getNodeName()).append("\n");
        rootCause.append("【请求】").append(method).append(" ").append(url).append("\n");

        if (errorMsg != null && !errorMsg.isEmpty()) {
            if (errorMsg.contains("Connection refused") || errorMsg.contains("connect timed out")) {
                rootCause.append("【根因】目标服务器不可达，连接被拒绝或超时\n");
                steps.append("1. 检查目标服务器是否启动并运行\n");
                steps.append("2. 检查URL地址是否正确: ").append(url).append("\n");
                steps.append("3. 检查网络连通性（防火墙/代理）\n");
                steps.append("4. 确认端口号是否正确\n");
                fix.append("• 确认目标服务已部署并启动\n");
                fix.append("• 检查URL配置: ").append(url).append("\n");
                fix.append("• 如有代理，确认代理配置正确");
            } else if (errorMsg.contains("timed out") || errorMsg.contains("SocketTimeout")) {
                rootCause.append("【根因】请求超时，服务器响应时间过长\n");
                steps.append("1. 检查服务器负载情况\n");
                steps.append("2. 增加超时时间配置\n");
                steps.append("3. 检查网络延迟\n");
                fix.append("• 优化服务器性能\n");
                fix.append("• 增大接口超时时间");
            } else if (errorMsg.contains("SSL") || errorMsg.contains("certificate")) {
                rootCause.append("【根因】SSL证书问题\n");
                steps.append("1. 检查目标服务器证书是否有效\n");
                steps.append("2. 检查系统时间是否正确\n");
                fix.append("• 更新根证书\n");
                fix.append("• 或跳过SSL验证（测试环境）");
            } else {
                rootCause.append("【根因】").append(errorMsg).append("\n");
                steps.append("1. 查看完整错误日志\n");
                steps.append("2. 检查请求参数是否正确\n");
                steps.append("3. 确认接口文档是否更新\n");
                fix.append("• 根据错误信息排查具体原因\n");
                fix.append("• 检查请求参数和请求体格式");
            }
        } else if (responseCode != null) {
            rootCause.append("【HTTP状态码】").append(responseCode).append("\n");
            if (responseCode >= 400 && responseCode < 500) {
                rootCause.append("【根因】客户端请求错误\n");
                steps.append("1. 检查请求参数是否符合接口要求\n");
                steps.append("2. 检查请求头是否正确（Content-Type、Authorization等）\n");
                steps.append("3. 检查请求体格式（JSON/Form）\n");
                if (responseCode == 401) {
                    steps.append("4. 检查认证Token是否有效或已过期\n");
                    fix.append("• 确认Token正确且未过期\n");
                    fix.append("• 检查认证方式是否匹配接口要求");
                } else if (responseCode == 403) {
                    steps.append("4. 检查是否有接口访问权限\n");
                    fix.append("• 确认账号有该接口的访问权限");
                } else if (responseCode == 404) {
                    steps.append("4. 确认接口URL路径是否正确\n");
                    fix.append("• 对照接口文档确认URL路径\n");
                    fix.append("• 当前URL: ").append(url);
                } else if (responseCode == 400) {
                    steps.append("4. 检查请求参数和必填字段\n");
                    fix.append("• 对照接口文档检查请求体\n");
                    if (responseBody != null && !responseBody.isEmpty()) {
                        fix.append("• 响应体提示: ").append(responseBody.length() > 200 ? responseBody.substring(0, 200) : responseBody);
                    }
                } else {
                    fix.append("• 根据HTTP状态码含义排查");
                }
            } else if (responseCode >= 500) {
                rootCause.append("【根因】服务器内部错误\n");
                steps.append("1. 检查目标服务器日志\n");
                steps.append("2. 确认服务是否正常运行\n");
                steps.append("3. 检查数据库/中间件连接\n");
                fix.append("• 联系后端开发查看服务器日志\n");
                fix.append("• 确认服务依赖是否正常");
            }
        } else {
            rootCause.append("【根因】未知错误，请查看详细日志\n");
            steps.append("1. 点击「查看详情」查看完整请求响应\n");
            steps.append("2. 检查网络连接\n");
            steps.append("3. 确认接口配置正确\n");
            fix.append("• 请提供更多上下文信息以便准确分析");
        }

        if (responseBody != null && !responseBody.isEmpty()) {
            rootCause.append("\n【响应内容摘要】").append(responseBody.length() > 300 ? responseBody.substring(0, 300) + "..." : responseBody);
        }

        analysis.put("rootCause", rootCause.toString());
        analysis.put("troubleshootingSteps", steps.toString());
        analysis.put("fixSuggestion", fix.toString());
        return analysis;
    }

    private String buildGenerateSystemPrompt(TestDataGenerateDTO dto) {
        String idMode = dto.getIdGenerateMode();
        int step = dto.getIdStep() != null ? dto.getIdStep() : 1;
        String startId = dto.getCustomStartId() != null ? String.valueOf(dto.getCustomStartId()) : "自动";

        return "你是一个接口测试数据生成专家。基于以下链路配置模板，生成符合业务规则的测试数据。\n" +
                "要求:\n" +
                "1. 严格输出合法的JSON格式\n" +
                "2. 数字、字符串、日期、手机号、邮箱、身份证号等格式合法合规\n" +
                "3. 金额为正数，状态值符合枚举范围\n" +
                "4. 上下游依赖变量保持前后一致\n" +
                "5. 生成正向可用测试数据，兼顾边界值场景\n" +
                "6. ID生成策略: 模式=" + idMode + ", 步长=" + step + ", 起始值=" + startId + "\n" +
                "7. 输出格式为JSON，key为节点编码(nodeCode)，value为包含bodyData的JSON对象";
    }

    private String buildGenerateUserPrompt(String chainCode, List<TestNodeConfig> nodes) {
        StringBuilder sb = new StringBuilder();
        sb.append("链路编码: ").append(chainCode).append("\n");
        sb.append("节点数量: ").append(nodes.size()).append("\n\n");

        for (int i = 0; i < nodes.size(); i++) {
            TestNodeConfig node = nodes.get(i);
            sb.append("节点").append(i + 1).append(":\n");
            sb.append("  nodeCode: ").append(node.getNodeCode()).append("\n");
            sb.append("  URL: ").append(node.getRequestUrl()).append("\n");
            sb.append("  方法: ").append(node.getRequestMethod()).append("\n");
            if (node.getBodyData() != null && !node.getBodyData().isEmpty()) {
                sb.append("  请求体: ").append(node.getBodyData()).append("\n");
            }
            sb.append("\n");
        }

        sb.append("请为每个节点生成完整的请求体数据，输出格式为:\n");
        sb.append("{\n");
        sb.append("  \"NODE_CODE_1\": {\"bodyData\": \"生成的JSON字符串\"},\n");
        sb.append("  \"NODE_CODE_2\": {\"bodyData\": \"生成的JSON字符串\"}\n");
        sb.append("}");

        return sb.toString();
    }

    private String buildAnalyzeSystemPrompt() {
        return "你是一个接口测试分析专家。根据传入的请求、响应、报错信息，自动分析根因并给出修复建议。\n" +
                "输出格式必须为JSON:\n" +
                "{\n" +
                "  \"rootCause\": \"根因定位\",\n" +
                "  \"troubleshootingSteps\": \"排查步骤\",\n" +
                "  \"fixSuggestion\": \"修复方案\"\n" +
                "}\n" +
                "分析维度: 参数格式错误/必填字段缺失/环境不可达/权限不足/业务校验失败/服务端代码异常/依赖数据不存在";
    }

    private String buildAnalyzeUserPrompt(TestNodeExecuteLog logEntry) {
        StringBuilder sb = new StringBuilder();
        sb.append("节点编码: ").append(logEntry.getNodeCode()).append("\n");
        sb.append("节点名称: ").append(logEntry.getNodeName()).append("\n");
        sb.append("URL: ").append(logEntry.getRequestUrl()).append("\n");
        sb.append("方法: ").append(logEntry.getRequestMethod()).append("\n");
        if (logEntry.getRequestHeaders() != null) {
            sb.append("请求头: ").append(logEntry.getRequestHeaders()).append("\n");
        }
        if (logEntry.getRequestBody() != null) {
            sb.append("请求体: ").append(logEntry.getRequestBody()).append("\n");
        }
        if (logEntry.getResponseCode() != null) {
            sb.append("响应码: ").append(logEntry.getResponseCode()).append("\n");
        }
        if (logEntry.getResponseBody() != null) {
            sb.append("响应内容: ").append(logEntry.getResponseBody()).append("\n");
        }
        if (logEntry.getErrorMessage() != null) {
            sb.append("错误堆栈: ").append(logEntry.getErrorMessage()).append("\n");
        }
        sb.append("\n请分析失败根因并给出修复建议。");
        return sb.toString();
    }

    private String callModel(String systemPrompt, String userPrompt) {
        String baseUrl = getConfigValue("ai.baseUrl", aiConfig.getBaseUrl());
        String apiKey = getConfigValue("ai.apiKey", aiConfig.getApiKey());
        String model = getConfigValue("ai.model", aiConfig.getModel());
        int timeout = Integer.parseInt(getConfigValue("ai.timeout", String.valueOf(aiConfig.getTimeoutSeconds())));

        ChatLanguageModel chatModel = OpenAiChatModel.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(model)
                .timeout(Duration.ofSeconds(timeout))
                .logRequests(true)
                .logResponses(true)
                .build();

        ChatRequest request = ChatRequest.builder()
                .messages(
                        new SystemMessage(systemPrompt),
                        new UserMessage(userPrompt)
                )
                .build();

        ChatResponse response = chatModel.chat(request);
        return response.aiMessage().text();
    }

    private String getConfigValue(String key, String defaultValue) {
        try {
            com.autotest.model.entity.SysConfig config = sysConfigMapper.selectByKey(key);
            if (config != null && config.getConfigValue() != null && !config.getConfigValue().isEmpty()) {
                return config.getConfigValue();
            }
        } catch (Exception e) {
            // ignore, use default
        }
        return defaultValue;
    }

    private Map<String, Object> parseGenerateResponse(String aiResponse, List<TestNodeConfig> nodes) {
        try {
            // Clean response - extract JSON
            String jsonStr = aiResponse.trim();
            if (jsonStr.contains("```json")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("```json") + 7);
                jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf("```"));
            } else if (jsonStr.contains("```")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("```") + 3);
                jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf("```"));
            }

            JSONObject result = JSON.parseObject(jsonStr.trim());
            Map<String, Object> nodeData = new LinkedHashMap<>();

            for (TestNodeConfig node : nodes) {
                if (result.containsKey(node.getNodeCode())) {
                    JSONObject nodeResult = result.getJSONObject(node.getNodeCode());
                    Map<String, String> data = new HashMap<>();
                    if (nodeResult.containsKey("bodyData")) {
                        data.put("bodyData", nodeResult.getString("bodyData"));
                    }
                    nodeData.put(node.getNodeCode(), data);
                }
            }

            return nodeData;
        } catch (Exception e) {
            log.error("Failed to parse AI generate response", e);
            throw new BusinessException(500, "AI返回数据格式错误，请重试");
        }
    }

    private Map<String, Object> generateMockData(List<TestNodeConfig> nodes) {
        Map<String, Object> nodeData = new LinkedHashMap<>();
        int idCounter = 1000;
        for (TestNodeConfig node : nodes) {
            Map<String, String> data = new HashMap<>();
            String method = node.getRequestMethod();
            String url = node.getRequestUrl() != null ? node.getRequestUrl().toLowerCase() : "";

            if ("GET".equals(method)) {
                if (url.contains("/user") || url.contains("/account")) {
                    data.put("bodyData", "userId=" + idCounter + "&name=测试用户&phone=138" + String.format("%08d", (int)(Math.random()*100000000)));
                } else if (url.contains("/order")) {
                    data.put("bodyData", "orderId=ORD" + System.currentTimeMillis() + "&status=1");
                } else if (url.contains("/product") || url.contains("/item")) {
                    data.put("bodyData", "productId=P" + String.format("%04d", idCounter) + "&keyword=测试");
                } else {
                    data.put("bodyData", "page=1&pageSize=20&keyword=test");
                }
                idCounter++;
            } else if (url.contains("/login")) {
                data.put("bodyData", "{\"username\":\"testuser\",\"password\":\"Test@1234\"}");
            } else if (url.contains("/user") || url.contains("/account")) {
                data.put("bodyData", "{\"userId\":" + (idCounter++) + ",\"name\":\"测试用户\",\"phone\":\"138" + String.format("%08d", (int)(Math.random()*100000000)) + "\",\"email\":\"test" + idCounter + "@example.com\"}");
            } else if (url.contains("/order")) {
                data.put("bodyData", "{\"orderId\":\"ORD" + System.currentTimeMillis() + "\",\"userId\":" + (idCounter++) + ",\"amount\":99.99,\"productId\":\"P001\",\"quantity\":1}");
            } else if (url.contains("/product") || url.contains("/item")) {
                data.put("bodyData", "{\"productId\":\"P" + String.format("%04d", idCounter++) + "\",\"name\":\"测试商品\",\"price\":29.99,\"stock\":100}");
            } else {
                data.put("bodyData", "{\"id\":" + (idCounter++) + ",\"name\":\"测试数据\",\"timestamp\":\"" + System.currentTimeMillis() + "\"}");
            }
            nodeData.put(node.getNodeCode(), data);
        }
        return nodeData;
    }

    private Map<String, String> parseAnalyzeResponse(String aiResponse) {
        try {
            String jsonStr = aiResponse.trim();
            if (jsonStr.contains("```json")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("```json") + 7);
                jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf("```"));
            } else if (jsonStr.contains("```")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("```") + 3);
                jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf("```"));
            }

            JSONObject result = JSON.parseObject(jsonStr.trim());
            Map<String, String> analysis = new HashMap<>();
            analysis.put("rootCause", result.getString("rootCause"));
            analysis.put("troubleshootingSteps", result.getString("troubleshootingSteps"));
            analysis.put("fixSuggestion", result.getString("fixSuggestion"));
            return analysis;
        } catch (Exception e) {
            log.error("Failed to parse AI analyze response", e);
            throw new BusinessException(500, "AI返回数据格式错误，请重试");
        }
    }
}
