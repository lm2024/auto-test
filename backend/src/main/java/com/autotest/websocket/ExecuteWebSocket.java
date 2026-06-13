package com.autotest.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;

@Component
@ServerEndpoint("/ws/execute/{executionId}")
public class ExecuteWebSocket {

    private static final Logger log = LoggerFactory.getLogger(ExecuteWebSocket.class);

    private static WebSocketSessionManager sessionManager;
    private static WebSocketPushService pushService;

    private Session session;
    private String executionId;

    @Autowired
    public void setSessionManager(WebSocketSessionManager manager) {
        sessionManager = manager;
    }

    @Autowired
    public void setPushService(WebSocketPushService service) {
        pushService = service;
    }

    @OnOpen
    public void onOpen(Session session, @PathParam("executionId") String executionId) {
        this.session = session;
        this.executionId = executionId;
        sessionManager.addSession(executionId, session);
        log.info("WebSocket connected: executionId={}", executionId);
    }

    @OnClose
    public void onClose() {
        sessionManager.removeSession(executionId, session);
        log.info("WebSocket closed: executionId={}", executionId);
    }

    @OnError
    public void onError(Session session, Throwable error) {
        log.error("WebSocket error: executionId={}, error={}", executionId, error.getMessage());
        sessionManager.removeSession(executionId, session);
    }
}
