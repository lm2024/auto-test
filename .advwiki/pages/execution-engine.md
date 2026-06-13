---
type: feature
project: auto-test
tags: [backend, execution, engine, websocket]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 执行引擎 (Execution Engine)

> 核心引擎：负责测试链路的解析、调度和执行。

## 架构概览

执行引擎采用 **三级层次结构**：

```
ExecutionPlan (执行计划)
  └── ExecutionGroup (执行组) × N
        └── ExecuteNode (执行节点) × M
```

## 核心类

| 类 | 文件 | 职责 |
|----|------|------|
| [ExecutionPlan](data-models#executionplan) | `engine/plan/ExecutionPlan.java` | 顶层执行计划，包含链编码、所有组、节点总数 |
| [ExecutionGroup](data-models#executiongroup) | `engine/plan/ExecutionGroup.java` | 执行组，支持并行执行（按 parallelGroup 分组） |
| [ExecuteNode](data-models#executenode) | `engine/plan/ExecuteNode.java` | 单个节点执行状态、耗时、错误信息 |
| [ExecutionContext](data-models#executioncontext) | `engine/context/ExecutionContext.java` | 执行上下文，变量存储、日志收集、停止标志 |

## 执行流程

```
ExecuteController.execute()
    ↓
ExecuteServiceImpl.executeChain(chainCode)
    ↓
1. 加载 TestChain 和 TestNodeConfig
2. 构建 ExecutionPlan
   - 按 sortNo 排序节点
   - 按 parallelGroup 分组
3. 创建 ExecutionContext
    ↓
按组顺序执行：
  对于每组：
    串行执行组内节点：
      对于每个 ExecuteNode：
        1. 占位符替换 (PlaceholderUtil)
        2. 根据 nodeType 执行对应逻辑
        3. 记录 TestNodeExecuteLog
        4. 变量提取 (JsonPathUtil) → 更新 ExecutionContext.variables
        5. 断言检查 (assertRules)
        6. WebSocket 推送状态 (WebSocketPushService)
    组内所有节点成功 → 下一组
    任一节点失败 → 根据策略继续/停止
    ↓
保存 TestExecuteMain 汇总结果
```

## API 端点 (ExecuteController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/execute/run` | POST | 启动链路执行 |
| `/api/execute/status` | GET | 查询执行主状态 |
| `/api/execute/nodeLogs` | GET | 查询节点级日志 |
| `/api/execute/stop` | POST | 停止执行 |

## 节点状态机

```
PENDING → RUNNING → SUCCESS
                     → FAILED
                     → SKIPPED (前置节点失败时跳过)
```

## 并行执行

节点通过 `parallelGroup` 字段分组：
- 同组节点并行执行
- 组间按 sortNo 顺序串行
- 任一组失败标记 `failed = true`，后续组跳过

## 变量传递

节点间通过 `ExecutionContext.variables` 共享变量：
- 提取规则 (extractRules): JSONPath 提取响应值
- 变量映射 (variableMapping): 重命名变量
- 占位符替换 (PlaceholderUtil): `${varName}` 语法引用

## 相关

- [[data-models]] — 数据模型详解
- [[websocket-realtime]] — WebSocket 实时推送
- [[utilities]] — 工具类


## 相关

- [[data-models]] — 数据模型详解
- [[websocket-realtime]] — WebSocket 实时推送
- [[utilities]] — 工具类
- [[error-handling]] — 异常处理机制