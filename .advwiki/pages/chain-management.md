---
type: feature
project: auto-test
tags: [backend, chain, node, crud]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 测试链路管理 (Chain Management)

> 核心功能：创建、编辑、查看和管理测试链路及其节点。

## 功能概述

测试链路（Chain）是平台的核心概念，用于编排一组测试节点（Node）按序或并行执行。

## 数据模型

| 实体 | 文件 | 说明 |
|------|------|------|
| [TestChain](data-models#testchain) | `model/entity/TestChain.java` | 链路实体：chainCode, chainName, executeMode, status |
| [TestNodeConfig](data-models#testnodeconfig) | `model/entity/TestNodeConfig.java` | 节点配置：nodeType, requestUrl, bodyData, extractRules, assertRules |

## API 端点

### 链路管理 (ChainController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chain/list` | GET | 获取链路列表 |
| `/api/chain/detail/{code}` | GET | 获取链路详情（含节点） |
| `/api/chain/create` | POST | 创建链路 (ChainCreateDTO) |
| `/api/chain/edit` | POST | 编辑链路 (ChainEditDTO) |
| `/api/chain/delete/{code}` | DELETE | 删除链路 |
| `/api/chain/toggle/{code}` | POST | 启用/禁用链路 |

### 节点管理 (NodeConfigController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/node/list/{chainCode}` | GET | 获取链下节点列表 |
| `/api/node/create` | POST | 创建节点 (NodeCreateDTO) |
| `/api/node/edit` | POST | 编辑节点 (NodeEditDTO) |
| `/api/node/delete/{id}` | DELETE | 删除节点 |
| `/api/node/reorder` | POST | 拖动调整节点顺序 |
| `/api/node/import` | POST | 批量导入节点 (NodeImportDTO) |

## 核心流程

```
用户创建链路
    ↓
ChainController.create()
    ↓
ChainServiceImpl.create()
    ↓ CodeGenerator.generateChainCode() 生成链路编码
    ↓ 保存 TestChain 到数据库
    ↓
返回链路编码，前端跳转到 ChainEdit 页面
```

## 节点类型

节点类型（nodeType）决定其行为：

- **HTTP 请求**: 发送 HTTP 请求，支持 GET/POST/PUT/DELETE
- **断言节点**: 对响应执行断言检查
- **变量提取**: 从响应中提取变量供后续节点使用
- **延迟节点**: 等待指定秒数后继续
- **插件节点**: 调用已注册的插件功能

## 前端页面

- [[frontend-pages#chain-list]] — 链路列表页
- [[frontend-pages#chain-edit]] — 链路编辑/节点编排页


## 前端页面

- [[frontend-pages#chain-list]] — 链路列表页
- [[frontend-pages#chain-edit]] — 链路编辑/节点编排页

## 相关

- [[data-models]] — 数据模型详解
- [[frontend-pages]] — 前端页面组件
- [[plugin-system]] — 插件动态加载
- [[error-handling]] — 异常处理机制