---
type: feature
project: auto-test
tags: [backend, ai, llm, failure-analysis]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# AI 集成 (AI Integration)

> 集成大语言模型，提供智能失败分析和文档生成功能。

## 功能概述

平台支持配置任意兼容 OpenAI API 的大模型，用于：
1. **失败分析**: 自动分析测试节点失败根因
2. **文档生成**: 浏览器插件选中内容后生成文档

## 配置 (AiConfig)

文件: `config/AiConfig.java`

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| `ai.base-url` | 必填 | — | API 基础 URL (如 `https://api.openai.com`) |
| `ai.api-key` | 必填 | — | API 密钥 |
| `ai.model` | 必填 | — | 模型名称 (如 `gpt-4`) |
| `ai.timeout-seconds` | 可选 | `120` | 请求超时秒数 |
| `ai.max-retries` | 可选 | `1` | 最大重试次数 |

配置方式: `application.yml` 或通过系统设置页面动态修改。

## API 端点 (AiController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ai/failure/analyze` | POST | AI 分析节点失败原因 |
| `/api/ai/config` | GET/POST | 查询/更新 AI 配置 |

## 失败分析流程 (AiServiceImpl)

```
前端点击「AI分析失败原因」
    ↓
AiController.failureAnalyze(FailureAnalyzeDTO)
    ↓
AiServiceImpl.analyze(executionId, nodeCode)
    ↓
1. 从数据库加载 TestNodeExecuteLog
2. 提取请求信息 (URL, Method, Headers, Body)
3. 提取响应信息 (StatusCode, Body)
4. 构建 Prompt 发送给大模型
5. 解析 AI 返回的 JSON 结果
    ↓
返回 FailureAnalyzeDTO:
  - rootCause: 根因定位
  - troubleshootingSteps: 排查步骤
  - fixSuggestion: 修复方案
  - source: "AI智能分析" 或 "规则分析"
```

## 降级策略

当 AI 模型未配置时，系统使用 **规则分析** 作为降级方案：
- 根据 HTTP 状态码判断失败类型
- 返回预设的排查模板

## 浏览器插件

浏览器插件支持选中文本后调用 AI 生成文档，配置入口在系统设置页面。

## 相关

- [[system-configuration]] — 系统设置页面
- [[frontend-pages#execute-detail]] — 前端 AI 分析 UI
