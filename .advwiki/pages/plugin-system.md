---
type: feature
project: auto-test
tags: [backend, plugin, dynamic-loading]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 插件系统 (Plugin System)

> 支持动态加载、注册和管理测试插件。

## 功能概述

插件系统允许扩展平台功能，无需修改核心代码即可添加新的测试节点类型。

## API 端点 (PluginController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/plugin/list` | GET | 获取已注册插件列表 |
| `/api/plugin/register` | POST | 注册新插件 |
| `/api/plugin/unregister/{id}` | DELETE | 卸载插件 |
| `/api/plugin/detail/{id}` | GET | 获取插件详情 |

## 数据模型

### PluginInterfaceDTO

文件: `model/dto/PluginInterfaceDTO.java`

| 字段 | 说明 |
|------|------|
| pluginId | 插件 ID |
| pluginName | 插件名称 |
| nodeType | 关联的节点类型 |
| description | 插件描述 |
| parameters | 参数定义 |
| version | 版本号 |

## 插件生命周期

```
插件开发
    ↓
打包为可执行模块
    ↓
PluginController.register() 注册
    ↓
系统加载插件元数据
    ↓
节点类型映射 (nodeType → pluginId)
    ↓
执行时调用插件处理逻辑
```

## 插件类型

常见的插件类型：
- **HTTP 请求插件**: 标准 HTTP 方法封装
- **数据库查询插件**: SQL 执行与结果验证
- **文件处理插件**: 文件上传/下载/比对
- **自定义脚本插件**: 执行自定义逻辑

## 相关

- [[chain-management]] — 节点中的插件类型
- [[data-models#pluginterface]] — 插件数据模型
- [[frontend-pages#system-config]] — 系统设置中的插件管理区域
