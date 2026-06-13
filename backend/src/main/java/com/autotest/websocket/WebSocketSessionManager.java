package com.autotest.websocket;

import org.springframework.stereotype.Component;

import javax.websocket.Session;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketSessionManager {

    private final ConcurrentHashMap<String, Set<Session>> sessionMap = new ConcurrentHashMap<>();

    public void addSession(String executionId, Session session) {
        sessionMap.computeIfAbsent(executionId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void removeSession(String executionId, Session session) {
        Set<Session> sessions = sessionMap.get(executionId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                sessionMap.remove(executionId);
            }
        }
    }

    public Set<Session> getSessions(String executionId) {
        return sessionMap.get(executionId);
    }
}
