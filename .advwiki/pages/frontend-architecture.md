---
type: reference
project: auto-test
tags: [frontend, vue, element-plus, routing]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 前端架构 (Frontend Architecture)

> Vue 3 + Element Plus 前端架构与路由设计。

## 技术栈

| 技术 | 版本/用途 |
|------|-----------|
| Vue 3 | 前端框架 (Composition API) |
| Element Plus | UI 组件库 |
| Vue Router | 路由管理 |
| Axios | HTTP 客户端 |
| Vite | 构建工具 |

## 项目结构

```
frontend/src/
├── main.js              # 入口
├── App.vue              # 根组件 (布局)
├── api/index.js         # Axios 封装
└── views/
    ├── ChainList.vue    # 链路列表
    ├── ChainEdit.vue    # 链路编辑/节点编排
    ├── ExecuteList.vue  # 执行记录列表
    ├── ExecuteDetail.vue # 执行详情 (含 WebSocket)
    └── SystemConfig.vue # 系统设置
```

## 路由配置 (router/index.js)

| 路径 | 组件 | 说明 |
|------|------|------|
| `/chain/list` | ChainList | 测试链路列表 |
| `/chain/edit/:code?` | ChainEdit | 链路编辑/节点编排 |
| `/execute/list` | ExecuteList | 执行记录列表 |
| `/execute/detail/:executionId` | ExecuteDetail | 执行详情 |
| `/system/config` | SystemConfig | 系统设置 |

## 根组件 (App.vue)

布局结构：

```
┌─────────────────────────────────────────┐
│  侧边栏 (el-aside, 200px)               │
│  ┌─────────────────────────────────┐   │
│  │  接口测试平台 (logo)              │   │
│  │  ┌───────────────────────────┐  │   │
│  │  │ 测试链路管理               │  │   │
│  │  │ 执行记录查询              │  │   │
│  │  │ 系统设置                  │  │   │
│  │  └───────────────────────────┘  │   │
│  └─────────────────────────────────┘   │
│                                       │
│         主内容区 (router-view)         │
│                                       │
└─────────────────────────────────────────┘
```

## API 封装 (api/index.js)

```javascript
const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})
```

- 所有请求自动添加 `/api` 前缀
- 统一超时 30 秒
- 响应拦截器直接返回 `response.data`
- 错误拦截器打印到 console

## 相关

- [[frontend-pages]] — 页面组件详解
- [[chain-management]] — 链路管理
- [[execution-engine]] — 执行引擎
