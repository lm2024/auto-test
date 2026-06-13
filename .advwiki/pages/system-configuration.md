---
type: feature
project: auto-test
tags: [backend, config, system]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 系统配置 (System Configuration)

> 管理全局系统参数和 AI 模型配置。

## 功能概述

系统配置模块提供可视化的参数管理界面，支持：
- AI 模型配置（URL、Key、Model、超时、重试）
- 系统参数 CRUD
- 插件配置管理

## 数据模型

### SysConfig 实体

文件: `model/entity/SysConfig.java`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 主键 |
| configKey | String | 配置键 |
| configValue | String | 配置值 |
| configDesc | String | 配置描述 |
| createTime | Date | 创建时间 |
| updateTime | Date | 更新时间 |

## API 端点 (ConfigController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/config/list` | GET | 获取所有配置项 |
| `/api/config/get/{key}` | GET | 获取单个配置 |
| `/api/config/save` | POST | 保存/更新配置 |
| `/api/config/delete/{key}` | DELETE | 删除配置 |

## 前端页面 (SystemConfig.vue)

文件: `frontend/src/views/SystemConfig.vue`

页面包含三个主要区域：

1. **AI 模型配置**: 配置 base-url、api-key、model 名称、超时时间
2. **系统参数管理**: 表格展示、新增、编辑、删除系统参数
3. **插件管理**: 查看已注册插件列表

## 配置优先级

```
application.yml (硬编码默认值)
    ↓ 覆盖
SysConfig 数据库表 (持久化用户配置)
    ↓ 覆盖
AiConfig 内存对象 (运行时配置)
```

## 相关

- [[ai-integration]] — AI 配置详解
- [[configuration]] — 后端配置体系
