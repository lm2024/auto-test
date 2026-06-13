---
type: feature
project: auto-test
tags: [backend, upload, excel, file]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 文件上传 (File Upload)

> 支持文件上传功能，包括 Excel 批量导入测试数据。

## API 端点 (UploadController)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload/excel` | POST | 上传 Excel 文件并解析 |
| `/api/upload/file` | POST | 通用文件上传 |

## 功能说明

### Excel 导入

1. 用户上传 `.xlsx` / `.xls` 文件
2. 后端解析 Excel 内容
3. 将数据转换为测试节点配置或测试数据
4. 支持批量创建节点

### 前端集成

在 ChainEdit 页面，可以通过「导入 Excel」按钮触发上传流程，将 Excel 中的数据批量转换为测试节点。

## 相关

- [[chain-management]] — 节点导入功能
- [[frontend-pages#chain-edit]] — 前端 Excel 导入 UI
- [[data-models#nodeimportdto]] — 节点导入 DTO
