---
type: feature
project: auto-test
tags: [backend, websocket, realtime, push]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# WebSocket 实时推送 (WebSocket Realtime)

> 基于 JSR-356 的 WebSocket 服务端点，实现执行进度的实时推送。

## 架构概览

```
前端 WebSocket 客户端
    ↕ (ws://{host}/ws/execute/{executionId})
ExecuteWebSocket (@ServerEndpoint)
    ↕
WebSocketSessionManager (会话管理)
    ↕
WebSocketPushService (消息推送)
    ↓ 执行引擎回调
```

## 核心类

| 类 | 文件 | 职责 |
|----|------|------|
| [ExecuteWebSocket](#executewebsocket) | `websocket/ExecuteWebSocket.java` | JSR-356 ServerEndpoint，处理连接/断开/错误 |
| [WebSocketSessionManager](#websessionsessionmanager) | `websocket/WebSocketSessionManager.java` | executionId → Session 集合的映射管理 |
| [WebSocketPushService](#websocketpushservice) | `websocket/WebSocketPushService.java` | 封装消息推送逻辑 |

## ServerEndpoint 配置

```java
@ServerEndpoint("/ws/execute/{executionId}")
```

客户端连接: `ws://{location.host}/ws/execute/{executionId}`

## 消息类型

### NODE_STATUS

节点级别状态推送：

```json
{
  "type": "NODE_STATUS",
  "executionId": "EXEC_xxx",
  "nodeCode": "NODE_xxx",
  "nodeName": "用户登录",
  "status": "SUCCESS",
  "costMs": 234,
  "responseCode": 200,
  "timestamp": 1718256000000
}
```

### CHAIN_STATUS

链路级别汇总推送：

```json
{
  "type": "CHAIN_STATUS",
  "executionId": "EXEC_xxx",
  "chainCode": "CHAIN_xxx",
  "status": "COMPLETED",
  "totalCostMs": 5678,
  "nodeCount": 10,
  "successCount": 9,
  "failCount": 1,
  "skipCount": 0,
  "timestamp": 1718256000000
}
```

## WebSocketSessionManager

```java
ConcurrentHashMap<String, Set<Session>> sessionMap
```

- `addSession(executionId, session)`: 添加会话
- `removeSession(executionId, session)`: 移除会话
- `getSessions(executionId)`: 获取某执行的所有会话

**线程安全**: 使用 `ConcurrentHashMap` + `ConcurrentHashMap.newKeySet()`。

## 前端集成 (ExecuteDetail.vue)

```javascript
const wsUrl = `ws://${location.host}/ws/execute/${executionId}`
ws = new WebSocket(wsUrl)
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'NODE_STATUS') { /* 更新节点状态 */ }
  else if (msg.type === 'CHAIN_STATUS') { /* 刷新总览 */ }
}
ws.onclose = () => setTimeout(connectWs, 3000) // 自动重连
```

## 相关

- [[execution-engine]] — 执行引擎
- [[frontend-pages#execute-detail]] — 前端实时 UI
