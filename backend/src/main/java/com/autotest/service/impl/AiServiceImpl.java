package com.autotest.service.impl;

import com.autotest.config.AiConfig;
import com.autotest.exception.BusinessException;
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

        // Build prompt
        String systemPrompt = buildAnalyzeSystemPrompt();
        String userPrompt = buildAnalyzeUserPrompt(logEntry);

        // Call AI model
        String aiResponse = callModel(systemPrompt, userPrompt);

        // Parse response
        return parseAnalyzeResponse(aiResponse);
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
        ChatLanguageModel model = OpenAiChatModel.builder()
                .apiKey(aiConfig.getApiKey())
                .baseUrl(aiConfig.getBaseUrl())
                .modelName(aiConfig.getModel())
                .timeout(Duration.ofSeconds(aiConfig.getTimeoutSeconds()))
                .logRequests(true)
                .logResponses(true)
                .build();

        ChatRequest request = ChatRequest.builder()
                .messages(
                        new SystemMessage(systemPrompt),
                        new UserMessage(userPrompt)
                )
                .build();

        ChatResponse response = model.chat(request);
        return response.aiMessage().text();
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
                data.put("bodyData", "");
            } else if (url.contains("/login")) {
                data.put("bodyData", "{\"username\":\"testuser\",\"password\":\"Test@1234\"}");
            } else if (url.contains("/user") || url.contains("/account")) {
                data.put("bodyData", "{\"userId\":" + (idCounter++) + ",\"name\":\"测试用户\",\"phone\":\"138\" + String.format(\"%08d\", (int)(Math.random()*100000000)),\"email\":\"test" + idCounter + "@example.com\"}");
            } else if (url.contains("/order")) {
                data.put("bodyData", "{\"orderId\":\"ORD" + System.currentTimeMillis() + "\",\"userId\":" + (idCounter++) + ",\"amount\":99.99,\"productId\":\"P001\",\"quantity\":1}");
            } else if (url.contains("/product") || url.contains("/item")) {
                data.put("bodyData", "{\"productId\":\"P" + String.format("%04d", idCounter++) + ",\"name\":\"测试商品\",\"price\":29.99,\"stock\":100}");
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
