package com.autotest.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;

@Component
@ServerEndpoint("/ws/browser/{executionId}")
public class BrowserWebSocket {

    private static final Logger log = LoggerFactory.getLogger(BrowserWebSocket.class);

    private static WebSocketSessionManager sessionManager;

    private Session session;
    private String executionId;

    @Autowired
    public void setSessionManager(WebSocketSessionManager manager) {
        sessionManager = manager;
    }

    @OnOpen
    public void onOpen(Session session, @PathParam("executionId") String executionId) {
        this.session = session;
        this.executionId = executionId;
        sessionManager.addSession(executionId, session);
        log.info("Browser WebSocket connected: executionId={}", executionId);
    }

    @OnClose
    public void onClose() {
        sessionManager.removeSession(executionId, session);
        log.info("Browser WebSocket closed: executionId={}", executionId);
    }

    @OnError
    public void onError(Session session, Throwable error) {
        log.error("Browser WebSocket error: executionId={}, error={}", executionId, error.getMessage());
        sessionManager.removeSession(executionId, session);
    }
}
