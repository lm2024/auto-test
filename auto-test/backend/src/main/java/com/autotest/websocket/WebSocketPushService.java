package com.autotest.websocket;

import com.alibaba.fastjson.JSON;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.websocket.Session;
import java.util.Set;

@Component
public class WebSocketPushService {

    private static final Logger log = LoggerFactory.getLogger(WebSocketPushService.class);

    @Autowired
    private WebSocketSessionManager sessionManager;

    public void pushMessage(String executionId, Object message) {
        Set<Session> sessions = sessionManager.getSessions(executionId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        String json = JSON.toJSONString(message);
        for (Session session : sessions) {
            try {
                if (session.isOpen()) {
                    session.getBasicRemote().sendText(json);
                }
            } catch (Exception e) {
                log.error("WebSocket push failed: executionId={}, error={}", executionId, e.getMessage());
            }
        }
    }

    public void pushNodeStatus(String executionId, String nodeCode, String nodeName,
                               String status, long costMs, Integer responseCode, String errorMessage) {
        java.util.HashMap<String, Object> msg = new java.util.HashMap<>();
        msg.put("type", "NODE_STATUS");
        msg.put("executionId", executionId);
        msg.put("nodeCode", nodeCode);
        msg.put("nodeName", nodeName);
        msg.put("status", status);
        msg.put("costMs", costMs);
        if (responseCode != null) msg.put("responseCode", responseCode);
        if (errorMessage != null) msg.put("errorMessage", errorMessage);
        msg.put("timestamp", System.currentTimeMillis());
        pushMessage(executionId, msg);
    }

    public void pushChainStatus(String executionId, String chainCode, String status,
                                long totalCostMs, int nodeCount, int successCount,
                                int failCount, int skipCount, String errorMessage) {
        java.util.HashMap<String, Object> msg = new java.util.HashMap<>();
        msg.put("type", "CHAIN_STATUS");
        msg.put("executionId", executionId);
        msg.put("chainCode", chainCode);
        msg.put("status", status);
        msg.put("totalCostMs", totalCostMs);
        msg.put("nodeCount", nodeCount);
        msg.put("successCount", successCount);
        msg.put("failCount", failCount);
        msg.put("skipCount", skipCount);
        if (errorMessage != null) msg.put("errorMessage", errorMessage);
        msg.put("timestamp", System.currentTimeMillis());
        pushMessage(executionId, msg);
    }
}
