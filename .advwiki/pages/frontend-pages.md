---
type: reference
project: auto-test
tags: [frontend, vue, component]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 前端页面 (Frontend Pages)

> 所有 Vue 页面组件的详细文档。

## ChainList.vue — 链路列表页

文件: `frontend/src/views/ChainList.vue`

**功能**:
- 展示所有测试链路列表 (表格)
- 搜索/筛选
- 新建链路按钮
- 编辑/删除/启用/禁用操作
- 点击链路名称跳转到编辑页

**交互**:
- 新建 → 调用 `ChainController.create()` → 跳转编辑页
- 编辑 → 跳转 `ChainEdit.vue` 并传入 chainCode
- 删除 → 调用 `ChainController.delete()`
- 启用/禁用 → 调用 `ChainController.toggle()`

## ChainEdit.vue — 链路编辑/节点编排页

文件: `frontend/src/views/ChainEdit.vue`

**功能**:
- 链路基本信息编辑 (名称、描述)
- **节点列表**: 可视化编排测试节点
- **节点 CRUD**: 添加、编辑、删除节点
- **节点排序**: 拖动调整节点顺序
- **节点详情查看**: 查看/编辑单个节点配置

**节点配置项**:
- 节点类型 (HTTP/断言/变量/延迟/插件)
- 请求 URL、方法、Headers
- 请求体 (JSON/Form-data/文件)
- 变量提取规则 (JSONPath)
- 断言规则
- 变量映射
- 并行组标识
- 排序号
- 延迟秒数

**Excel 导入**: 支持通过上传 Excel 批量创建节点

## ExecuteList.vue — 执行记录列表

文件: `frontend/src/views/ExecuteList.vue`

**功能**:
- 展示所有执行记录
- 按链路/状态筛选
- 点击查看执行详情

**列表字段**: executionId, chainName, status, totalCostMs, nodeCount, createTime

## ExecuteDetail.vue — 执行详情页

文件: `frontend/src/views/ExecuteDetail.vue`

**功能**:
- 执行总览 (状态、耗时、节点统计)
- **节点日志卡片**: 按执行顺序展示每个节点的状态
- **节点详情弹窗**: 查看请求/响应完整内容
- **AI 失败分析**: 点击按钮触发 AI 分析
- **WebSocket 实时推送**: 连接 WebSocket 接收实时状态更新

**WebSocket 集成**:
```javascript
// 自动连接，断线 3 秒后重连
ws = new WebSocket(`ws://${location.host}/ws/execute/${executionId}`)
```

**节点卡片样式**:
- 成功: 左边框绿色
- 失败: 左边框红色
- 运行中: 左边框蓝色
- 跳过: 左边框灰色

**AI 分析结果展示**:
- 根因定位 (红色图标)
- 排查步骤 (蓝色图标)
- 修复方案 (绿色图标)
- 来源标识: "AI智能分析" (蓝色) 或 "规则分析" (橙色)

## SystemConfig.vue — 系统设置页

文件: `frontend/src/views/SystemConfig.vue`

**三大区域**:

1. **AI 模型配置**:
   - Base URL 输入框
   - API Key 输入框 (密码掩码)
   - 模型名称
   - 超时时间
   - 最大重试次数
   - 保存按钮

2. **系统参数管理**:
   - 参数表格 (key, value, 描述)
   - 新增/编辑/删除

3. **插件管理**:
   - 已注册插件列表
   - 插件详情查看

## 相关

- [[frontend-architecture]] — 前端架构
- [[websocket-realtime]] — WebSocket 推送
- [[ai-integration]] — AI 集成


## 相关

- [[frontend-architecture]] — 前端架构
- [[websocket-realtime]] — WebSocket 推送
- [[ai-integration]] — AI 集成
- [[file-upload]] — 文件上传功能
- [[plugin-system]] — 插件系统