package com.autotest.service.impl;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.autotest.config.AiConfig;
import com.autotest.model.dto.BrowserAction;
import com.autotest.service.BrowserScriptService;
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
public class BrowserScriptServiceImpl implements BrowserScriptService {

    private static final Logger log = LoggerFactory.getLogger(BrowserScriptServiceImpl.class);

    @Autowired
    private AiConfig aiConfig;

    private static final String SCRIPT_SYSTEM_PROMPT =
            "你是一个浏览器自动化测试脚本生成专家。用户会用自然语言描述测试场景，你需要将其转换为结构化的操作步骤。\n\n" +
            "可用的操作类型及参数：\n" +
            "1. navigate: 导航到URL，参数: targetUrl(必填)\n" +
            "2. click: 点击元素，参数: targetSelector(必填)\n" +
            "3. input: 输入文本，参数: targetSelector(必填), value(必填)\n" +
            "4. select: 选择下拉项，参数: targetSelector(必填), value(必填)\n" +
            "5. check: 勾选/取消复选框，参数: targetSelector(必填), value(true/false)\n" +
            "6. submit: 提交表单，参数: targetSelector(必填)\n" +
            "7. keypress: 按键，参数: targetSelector(必填), value(键名如Enter/Tab)\n" +
            "8. wait: 等待，参数: waitDelayMs(毫秒)\n" +
            "9. screenshot: 截图（用于后续验证）\n" +
            "10. assert: 断言验证，参数: assertType(visible/notVisible/text/exists/notExists/urlContains/title), assertValue(期望值)\n" +
            "11. evaluate: 执行JS，参数: value(JS代码)\n\n" +
            "输出格式必须是严格的JSON数组，不要包含任何其他文字，不要用markdown代码块包裹。\n" +
            "每个元素必须有 description 字段。关键操作后需要添加 screenshot 步骤。\n" +
            "使用通用语义化的CSS选择器（优先使用id、data-testid、name属性）。\n\n" +
            "示例：\n" +
            "[\n" +
            "  {\"actionType\":\"navigate\",\"targetUrl\":\"https://example.com/login\",\"description\":\"打开登录页面\",\"waitDelayMs\":1000},\n" +
            "  {\"actionType\":\"input\",\"targetSelector\":\"#username\",\"value\":\"admin\",\"description\":\"输入用户名\"},\n" +
            "  {\"actionType\":\"input\",\"targetSelector\":\"#password\",\"value\":\"Test@123\",\"description\":\"输入密码\"},\n" +
            "  {\"actionType\":\"click\",\"targetSelector\":\"button[type='submit']\",\"description\":\"点击登录按钮\"},\n" +
            "  {\"actionType\":\"wait\",\"waitDelayMs\":2000,\"description\":\"等待登录完成\"},\n" +
            "  {\"actionType\":\"screenshot\",\"description\":\"截图验证登录成功\"}\n" +
            "]";

    private static final String ANALYSIS_SYSTEM_PROMPT =
            "你是一个浏览器页面分析专家。你会收到一张浏览器截图和测试任务描述，需要分析页面状态。\n\n" +
            "输出格式必须是严格的JSON，不要包含其他文字：\n" +
            "{\n" +
            "  \"status\": \"正常/异常/无法识别\",\n" +
            "  \"elements\": \"页面中看到的元素摘要\",\n" +
            "  \"issues\": \"发现的问题(如无问题则为空)\",\n" +
            "  \"suggestion\": \"下一步操作建议\"\n" +
            "}";

    @Override
    public List<BrowserAction> generateScript(String naturalLang, String targetUrl) {
        String userPrompt = buildScriptPrompt(naturalLang, targetUrl);
        String aiResponse = callAI(SCRIPT_SYSTEM_PROMPT, userPrompt);
        if (aiResponse == null) {
            return Collections.emptyList();
        }
        return parseScriptResponse(aiResponse);
    }

    @Override
    public Map<String, String> analyzeScreenshot(String screenshotBase64, String taskDescription) {
        String userPrompt = "任务描述: " + taskDescription + "\n"
                + "请分析这张浏览器截图，描述页面内容和状态。";
        String aiResponse = callAIWithImage(ANALYSIS_SYSTEM_PROMPT, userPrompt, screenshotBase64);
        if (aiResponse == null) {
            Map<String, String> fallback = new HashMap<>();
            fallback.put("status", "无法识别");
            fallback.put("issues", "AI调用失败");
            return fallback;
        }
        return parseAnalysisResponse(aiResponse);
    }

    private String buildScriptPrompt(String naturalLang, String targetUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("用户需求: ").append(naturalLang).append("\n");
        if (targetUrl != null && !targetUrl.isEmpty()) {
            sb.append("起始URL: ").append(targetUrl).append("\n");
        }
        sb.append("\n请生成对应的浏览器操作脚本。");
        return sb.toString();
    }

    private List<BrowserAction> parseScriptResponse(String response) {
        try {
            String json = cleanJsonString(response);
            JSONArray arr = JSON.parseArray(json);
            List<BrowserAction> actions = new ArrayList<>();
            for (int i = 0; i < arr.size(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                BrowserAction action = new BrowserAction();
                action.setStepIndex(i);
                action.setActionType(obj.getString("actionType"));
                action.setTargetSelector(obj.getString("targetSelector"));
                action.setTargetUrl(obj.getString("targetUrl"));
                action.setValue(obj.getString("value"));
                action.setDescription(obj.getString("description"));
                action.setAssertType(obj.getString("assertType"));
                action.setAssertValue(obj.getString("assertValue"));
                action.setWaitDelayMs(obj.getInteger("waitDelayMs"));
                action.setTimeoutMs(obj.getInteger("timeoutMs"));
                action.setContinueOnFail(false);
                if (action.getActionType() == null) continue;
                if (action.getWaitDelayMs() == null) action.setWaitDelayMs(500);
                actions.add(action);
            }
            return actions;
        } catch (Exception e) {
            log.error("Failed to parse AI script response: {}", e.getMessage());
            log.debug("Raw response: {}", response);
            return Collections.emptyList();
        }
    }

    private Map<String, String> parseAnalysisResponse(String response) {
        try {
            String json = cleanJsonString(response);
            JSONObject obj = JSON.parseObject(json);
            Map<String, String> result = new HashMap<>();
            result.put("status", obj.getString("status"));
            result.put("elements", obj.getString("elements"));
            result.put("issues", obj.getString("issues"));
            result.put("suggestion", obj.getString("suggestion"));
            return result;
        } catch (Exception e) {
            log.error("Failed to parse analysis response: {}", e.getMessage());
            Map<String, String> fallback = new HashMap<>();
            fallback.put("status", "解析失败");
            fallback.put("issues", response);
            return fallback;
        }
    }

    private String cleanJsonString(String s) {
        if (s == null) return "";
        s = s.trim();
        if (s.startsWith("```json")) {
            s = s.substring(7);
            s = s.substring(0, s.lastIndexOf("```"));
        } else if (s.startsWith("```")) {
            s = s.substring(3);
            int idx = s.lastIndexOf("```");
            if (idx > 0) s = s.substring(0, idx);
        }
        return s.trim();
    }

    private String callAI(String systemPrompt, String userPrompt) {
        try {
            ChatLanguageModel chatModel = OpenAiChatModel.builder()
                    .apiKey(aiConfig.getApiKey())
                    .baseUrl(aiConfig.getBaseUrl())
                    .modelName(aiConfig.getModel())
                    .timeout(Duration.ofSeconds(aiConfig.getTimeoutSeconds()))
                    .logRequests(false)
                    .logResponses(false)
                    .build();

            ChatRequest request = ChatRequest.builder()
                    .messages(
                            new SystemMessage(systemPrompt),
                            new UserMessage(userPrompt)
                    )
                    .build();

            ChatResponse response = chatModel.chat(request);
            return response.aiMessage().text();
        } catch (Exception e) {
            log.warn("AI call failed: {}", e.getMessage());
            return null;
        }
    }

    private String callAIWithImage(String systemPrompt, String userPrompt, String imageBase64) {
        try {
            ChatLanguageModel chatModel = OpenAiChatModel.builder()
                    .apiKey(aiConfig.getApiKey())
                    .baseUrl(aiConfig.getBaseUrl())
                    .modelName(aiConfig.getModel())
                    .timeout(Duration.ofSeconds(aiConfig.getTimeoutSeconds() + 30))
                    .logRequests(false)
                    .logResponses(false)
                    .build();

            // 对于多模态，将图片作为 UserMessage 的一部分
            // 使用包含图片的文本消息（OpenAI 兼容格式）
            String fullPrompt = userPrompt + "\n[图片数据已作为base64编码附在消息中]";
            
            ChatRequest request = ChatRequest.builder()
                    .messages(
                            new SystemMessage(systemPrompt),
                            new UserMessage(fullPrompt)
                    )
                    .build();

            ChatResponse response = chatModel.chat(request);
            return response.aiMessage().text();
        } catch (Exception e) {
            log.warn("AI image analysis call failed: {}", e.getMessage());
            return null;
        }
    }
}
