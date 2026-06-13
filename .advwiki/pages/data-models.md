---
type: reference
project: auto-test
tags: [backend, entity, dto, vo, database]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 数据模型 (Data Models)

> 后端所有实体、DTO 和 VO 的完整参考。

## 实体 (Entity)

### SysConfig

文件: `model/entity/SysConfig.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 |
| configKey | String | 配置键 |
| configValue | String | 配置值 |
| configDesc | String | 描述 |
| createTime | Date | 创建时间 |
| updateTime | Date | 更新时间 |

Mapper: `SysConfigMapper.xml`

### TestChain

文件: `model/entity/TestChain.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 |
| chainCode | String | 链路编码 (CHAIN_xxx) |
| chainName | String | 链路名称 |
| executeMode | Integer | 执行模式 (0=串行, 1=并行) |
| description | String | 描述 |
| status | Integer | 状态 (0=禁用, 1=启用) |
| createBy | String | 创建人 |
| createTime / updateTime | Date | 时间戳 |

Mapper: `TestChainMapper.xml`

### TestNodeConfig

文件: `model/entity/TestNodeConfig.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 |
| chainCode | String | 所属链路编码 |
| nodeId | Long | 节点 ID |
| nodeCode | String | 节点编码 (NODE_xxx) |
| nodeName | String | 节点名称 |
| nodeType | String | 节点类型 |
| sortNo | Integer | 排序号 |
| parallelGroup | String | 并行组标识 |
| requestUrl | String | 请求 URL |
| requestMethod | String | HTTP 方法 |
| requestHeaders | String | 请求头 (JSON) |
| bodyType | String | 请求体类型 |
| bodyData | String | 请求体数据 |
| extractRules | String | 变量提取规则 (JSON) |
| assertRules | String | 断言规则 (JSON) |
| variableMapping | String | 变量映射 (JSON) |
| delaySeconds | Integer | 延迟秒数 |

Mapper: `TestNodeConfigMapper.xml`

### TestExecuteMain

文件: `model/entity/TestExecuteMain.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 |
| executionId | String | 执行 ID (EXEC_xxx) |
| chainCode | String | 链路编码 |
| status | String | 状态 (RUNNING/SUCCESS/FAILED/CANCELLED) |
| startTime / endTime | Date | 时间范围 |
| totalCostMs | Long | 总耗时 |
| nodeCount / successCount / failCount / skipCount | Integer | 节点统计 |
| errorMessage | String | 错误信息 |

Mapper: `TestExecuteMainMapper.xml`

### TestNodeExecuteLog

文件: `model/entity/TestNodeExecuteLog.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 |
| executionId | String | 执行 ID |
| nodeCode / nodeName | String | 节点标识 |
| status | String | 节点状态 |
| requestUrl / requestMethod | String | 请求信息 |
| requestHeaders / requestBody | String | 请求内容 |
| responseCode | Integer | 响应状态码 |
| responseHeaders / responseBody | String | 响应内容 |
| costMs | Long | 耗时 |
| errorMessage | String | 错误信息 |
| extractedVars | String | 提取的变量 (JSON) |

Mapper: `TestNodeExecuteLogMapper.xml`

## 数据传输对象 (DTO)

| DTO | 文件 | 用途 |
|-----|------|------|
| ChainCreateDTO | `model/dto/ChainCreateDTO.java` | 创建链路 |
| ChainEditDTO | `model/dto/ChainEditDTO.java` | 编辑链路 |
| NodeCreateDTO | `model/dto/NodeCreateDTO.java` | 创建节点 |
| NodeEditDTO | `model/dto/NodeEditDTO.java` | 编辑节点 |
| NodeImportDTO | `model/dto/NodeImportDTO.java` | 批量导入节点 |
| PluginChainCreateDTO | `model/dto/PluginChainCreateDTO.java` | 插件链路创建 |
| PluginChainAppendDTO | `model/dto/PluginChainAppendDTO.java` | 插件链路追加 |
| PluginInterfaceDTO | `model/dto/PluginInterfaceDTO.java` | 插件接口信息 |
| TestDataGenerateDTO | `model/dto/TestDataGenerateDTO.java` | 测试数据生成 |
| FailureAnalyzeDTO | `model/dto/FailureAnalyzeDTO.java` | 失败分析请求 |

## 视图对象 (VO)

| VO | 文件 | 用途 |
|----|------|------|
| Result<T> | `model/vo/Result.java` | 统一响应包装 (code, message, data) |
| ChainVO | `model/vo/ChainVO.java` | 链路视图（含节点列表） |
| NodeVO | `model/vo/NodeVO.java` | 节点视图 |
| ExecuteMainVO | `model/vo/ExecuteMainVO.java` | 执行主记录视图 |
| NodeExecuteLogVO | `model/vo/NodeExecuteLogVO.java` | 节点日志视图 |

## 内存模型 (Engine)

| 类 | 包 | 说明 |
|----|-----|------|
| ExecutionPlan | `engine/plan` | 执行计划 |
| ExecutionGroup | `engine/plan` | 执行组 |
| ExecuteNode | `engine/plan` | 执行节点 |
| ExecutionContext | `engine/context` | 执行上下文 |

## ER 关系

```
TestChain (1) ──< (N) TestNodeConfig
    │
    │ (1) ──< (N) TestExecuteMain
    │
    └─────────────────< (N) TestNodeExecuteLog
```

## 相关

- [[chain-management]] — 链路管理功能
- [[execution-engine]] — 执行引擎
- [[configuration]] — 配置体系
