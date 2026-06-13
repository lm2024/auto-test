---
type: reference
project: auto-test
tags: [backend, configuration, spring-boot]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 后端配置体系 (Configuration)

> Spring Boot 应用的配置管理：AI 配置、跨域、线程池、WebSocket。

## 配置文件

`backend/src/main/resources/application.yml`

## 配置类

### AiConfig

文件: `config/AiConfig.java`

AI 大模型连接配置，从 `application.yml` 读取：

```yaml
ai:
  base-url: https://api.example.com
  api-key: sk-xxx
  model: gpt-4
  timeout-seconds: 120
  max-retries: 1
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| baseUrl | String | (必填) | API 基础 URL |
| apiKey | String | (必填) | API 密钥 |
| model | String | (必填) | 模型名称 |
| timeoutSeconds | int | 120 | 超时秒数 |
| maxRetries | int | 1 | 最大重试次数 |

### CorsConfig

文件: `config/CorsConfig.java`

跨域配置，允许前端跨域访问后端 API。

### ThreadPoolConfig

文件: `config/ThreadPoolConfig.java`

线程池配置，用于异步执行测试任务。

```java
@EnableAsync
```

### WebSocketConfig

文件: `config/WebSocketConfig.java`

WebSocket 端点配置。

```
ServerEndpoint: /ws/execute/{executionId}
```

## 应用入口

文件: `AutoTestApplication.java`

```java
@SpringBootApplication
@MapperScan("com.autotest.mapper")
@EnableAsync
```

- `@MapperScan`: 扫描 MyBatis Mapper 接口
- `@EnableAsync`: 启用异步执行

## MyBatis Mapper XML

| Mapper XML | 对应实体 | 用途 |
|------------|----------|------|
| SysConfigMapper.xml | SysConfig | 系统参数 CRUD |
| TestChainMapper.xml | TestChain | 链路 CRUD |
| TestNodeConfigMapper.xml | TestNodeConfig | 节点配置 CRUD |
| TestExecuteMainMapper.xml | TestExecuteMain | 执行记录 CRUD |
| TestNodeExecuteLogMapper.xml | TestNodeExecuteLog | 节点日志 CRUD |

## 相关

- [[ai-integration]] — AI 配置详解
- [[system-configuration]] — 系统配置页面
- [[data-models]] — 数据模型
