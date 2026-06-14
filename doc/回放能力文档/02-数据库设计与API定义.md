# 回放能力 — 数据库设计与 API 定义（更新版）

> 基于需求确认结果更新，新增版本管理、AI 分析、并行回放支持。

---

## 一、数据库表设计

### 1.1 修改现有表：`test_chain` 增加字段

```sql
ALTER TABLE test_chain 
    ADD COLUMN current_version INT DEFAULT 1 COMMENT '当前版本号' AFTER status,
    ADD COLUMN chain_fingerprint VARCHAR(128) COMMENT '链路指纹（MD5）' AFTER chain_code;
```

### 1.2 新增表：`test_chain_version`

```sql
CREATE TABLE test_chain_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chain_code VARCHAR(64) NOT NULL COMMENT '链路编码',
    chain_fingerprint VARCHAR(128) NOT NULL COMMENT '链路指纹',
    version INT NOT NULL COMMENT '版本号，同一chain_code从1递增',
    chain_name VARCHAR(128) COMMENT '链路名称',
    execute_mode TINYINT DEFAULT 1 COMMENT '1串行 2分组并行',
    description TEXT COMMENT '版本描述',
    node_snapshot LONGTEXT COMMENT '节点快照JSON（完整interfaceList）',
    diff_result LONGTEXT COMMENT '与上一版本的Diff结果JSON',
    ai_analysis TEXT COMMENT 'AI差异分析结果',
    status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT 'ACTIVE/ARCHIVED',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    create_by VARCHAR(64) COMMENT '创建者',
    UNIQUE KEY uk_chain_version (chain_code, version),
    KEY idx_fingerprint (chain_fingerprint),
    KEY idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链路版本表';
```

### 1.3 新增表：`test_node_snapshot`

```sql
CREATE TABLE test_node_snapshot (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    version_id BIGINT NOT NULL COMMENT '关联test_chain_version.id',
    chain_code VARCHAR(64) NOT NULL,
    node_id BIGINT COMMENT '节点ID',
    node_code VARCHAR(64) COMMENT '节点编码',
    node_name VARCHAR(128) COMMENT '节点名称',
    node_type VARCHAR(16) DEFAULT 'HTTP' COMMENT '节点类型',
    sort_no INT COMMENT '排序号',
    parallel_group VARCHAR(32) COMMENT '并行组标识',
    request_url TEXT COMMENT '请求URL',
    request_method VARCHAR(10) COMMENT '请求方法',
    request_headers LONGTEXT COMMENT '请求头JSON',
    body_type VARCHAR(32) COMMENT 'Body类型',
    body_data LONGTEXT COMMENT '请求体',
    response_code INT COMMENT '响应状态码',
    response_headers LONGTEXT COMMENT '响应头JSON',
    response_body LONGTEXT COMMENT '响应体',
    duration_ms BIGINT COMMENT '请求耗时(ms)',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_version_id (version_id),
    KEY idx_chain_code (chain_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口快照表';
```

### 1.4 ER 关系

```
test_chain (1) ──── (N) test_chain_version
       │                      │
       │ chain_fingerprint    │ version_id
       │ (相同指纹=同一链路)   │
       │                      │
       └──────────────────────┴── (N) test_node_snapshot
```

### 1.5 同一链路识别逻辑

```sql
-- 查询同一链路的所有版本（按指纹聚合）
SELECT cv.*, c.chain_fingerprint
FROM test_chain_version cv
JOIN test_chain c ON cv.chain_code = c.chain_code
WHERE c.chain_fingerprint = '目标指纹'
ORDER BY cv.version DESC;

-- 查询某链路的所有历史版本
SELECT * FROM test_chain_version
WHERE chain_code = 'CHAIN_240612A3F7'
ORDER BY version DESC;

-- 查询最近5个版本（默认展示）
SELECT * FROM test_chain_version
WHERE chain_code = 'CHAIN_240612A3F7'
ORDER BY version DESC
LIMIT 5;
```

---

## 二、链路指纹算法

### 2.1 生成规则

```
输入：链路中所有节点的 [request_method + URL路径]
处理：
  1. 按 sort_no 排序所有节点
  2. 提取每个节点的 URL 路径（去掉 ? 后的 GET 参数）
  3. 拼接：method1|path1|method2|path2|...
  4. 计算 MD5 哈希
输出：32位十六进制字符串
```

### 2.2 示例

```
链路包含 3 个节点：
  1. GET  /api/user/info?token=abc&page=1
  2. POST /api/order/create
  3. GET  /api/product/list?category=1

路径提取：
  1. GET /api/user/info        （忽略 ?token=abc&page=1）
  2. POST /api/order/create
  3. GET /api/product/list     （忽略 ?category=1）

拼接：GET|/api/user/info|POST|/api/order/create|GET|/api/product/list
MD5：  a1b2c3d4e5f6...（32位）
```

### 2.3 相同链路判定

- 两条链路的 `chain_fingerprint` 相同 → 视为「同一链路」
- 同一链路可有多个 `chain_code`（不同测试人员创建），但指纹相同
- 前端按指纹聚合展示，方便查找

---

## 三、后端 API 设计

### 3.1 插件端 API

#### 3.1.1 获取链路列表

```
GET /api/plugin/chain/list
Query:
  keyword     string  可选，搜索关键词（匹配链路名称、URL路径）
  method      string  可选，HTTP方法筛选（GET/POST/PUT/DELETE）
  pageNum     int     页码，默认1
  pageSize    int     每页条数，默认20
Response:
{
  "code": 200,
  "data": {
    "total": 100,
    "list": [
      {
        "chainCode": "CHAIN_240612A3F7",
        "chainName": "用户下单流程",
        "chainFingerprint": "a1b2c3d4...",
        "currentVersion": 3,
        "nodeCount": 5,
        "executeMode": 1,
        "status": 1,
        "createTime": "2024-06-12 10:00:00"
      }
    ]
  }
}
```

#### 3.1.2 获取链路详情

```
GET /api/plugin/chain/detail
Query:
  chainCode   string  必填
Response:
{
  "code": 200,
  "data": {
    "chainCode": "CHAIN_240612A3F7",
    "chainName": "用户下单流程",
    "currentVersion": 3,
    "executeMode": 1,
    "nodes": [
      {
        "nodeId": 1,
        "nodeCode": "NODE_001",
        "nodeName": "获取用户信息",
        "nodeType": "HTTP",
        "sortNo": 1,
        "parallelGroup": "",
        "requestUrl": "http://api.example.com/user/info",
        "requestMethod": "GET",
        "requestHeaders": "{}",
        "bodyType": "JSON",
        "bodyData": null,
        "extractRules": "[]",
        "assertRules": "[]"
      }
    ]
  }
}
```

#### 3.1.3 推送回放结果（创建新版本）

```
POST /api/plugin/chain/replay/push
Body:
{
  "chainCode": "CHAIN_240612A3F7",     // 可选，不传则匹配指纹
  "chainName": "用户下单流程",           // 可选
  "replayNodes": [
    {
      "nodeName": "获取用户信息",
      "nodeType": "HTTP",
      "sort": 1,
      "parallelGroup": "",
      "requestUrl": "http://api.example.com/user/info",
      "requestMethod": "GET",
      "requestHeaders": "{}",
      "bodyType": "JSON",
      "bodyData": null,
      "responseCode": 200,
      "responseHeaders": "{}",
      "responseBody": "{...}",
      "durationMs": 120
    }
  ]
}
Response:
{
  "code": 200,
  "data": {
    "chainCode": "CHAIN_240612A3F7",
    "version": 4,
    "chainFingerprint": "a1b2c3d4...",
    "diffResult": {
      "added": [...],
      "removed": [...],
      "modified": [...],
      "unchanged": [...],
      "summary": {
        "added": 1,
        "removed": 0,
        "modified": 2,
        "unchanged": 2
      }
    },
    "aiAnalysis": {
      "summary": "本次变更主要涉及订单创建接口升级到v2版本",
      "impacts": ["..."],
      "suggestions": ["..."]
    },
    "message": "推送成功，与上一版本对比：新增1个接口，修改2个接口"
  }
}
```

### 3.2 前端 API

#### 3.2.1 获取链路版本列表

```
GET /api/chain/versions
Query:
  chainCode   string  必填
  all         boolean 可选，true=返回所有版本，默认只返回最近5个
Response:
{
  "code": 200,
  "data": {
    "total": 12,
    "list": [
      {
        "versionId": 10,
        "version": 4,
        "chainName": "用户下单流程",
        "nodeCount": 5,
        "diffSummary": {
          "added": 1,
          "removed": 0,
          "modified": 2,
          "unchanged": 2
        },
        "createTime": "2024-06-15 09:30:00",
        "createBy": "张三"
      }
    ]
  }
}
```

#### 3.2.2 获取版本 Diff 详情

```
GET /api/chain/version/diff
Query:
  chainCode   string  必填
  version     int     必填，要查看的版本号
Response:
{
  "code": 200,
  "data": {
    "chainCode": "CHAIN_240612A3F7",
    "currentVersion": 4,
    "compareVersion": 3,
    "nodes": [
      {
        "nodeCode": "NODE_001",
        "nodeName": "获取用户信息",
        "sortNo": 1,
        "changeType": "UNCHANGED",
        "current": { ... },
        "previous": { ... },
        "fieldChanges": []
      },
      {
        "nodeCode": "NODE_002",
        "nodeName": "创建订单",
        "sortNo": 2,
        "changeType": "MODIFIED",
        "current": { ... },
        "previous": { ... },
        "fieldChanges": [
          {
            "field": "requestUrl",
            "label": "请求地址",
            "oldValue": "http://api.example.com/order/create",
            "newValue": "http://api.example.com/v2/order/create"
          },
          {
            "field": "bodyData",
            "label": "请求体",
            "oldValue": "{\"productId\": 123}",
            "newValue": "{\"productId\": 123, \"quantity\": 2}"
          }
        ]
      }
    ],
    "summary": {
      "added": 1,
      "removed": 0,
      "modified": 2,
      "unchanged": 2
    },
    "aiAnalysis": {
      "summary": "...",
      "impacts": ["..."],
      "suggestions": ["..."]
    }
  }
}
```

#### 3.2.3 保存版本（编辑后）

```
POST /api/chain/version/save
Body:
{
  "chainCode": "CHAIN_240612A3F7",
  "chainName": "用户下单流程-v2",
  "executeMode": 1,
  "description": "更新了订单创建接口的参数",
  "nodes": [ ... ]
}
Response:
{
  "code": 200,
  "data": {
    "version": 5,
    "message": "保存成功"
  }
}
```

#### 3.2.4 删除版本

```
DELETE /api/chain/version/delete
Body:
{
  "chainCode": "CHAIN_240612A3F7",
  "version": 2
}
Response:
{
  "code": 200,
  "message": "删除成功"
}
```

#### 3.2.5 批量删除版本

```
POST /api/chain/version/batchDelete
Body:
{
  "chainCode": "CHAIN_240612A3F7",
  "beforeVersion": 3    // 删除版本号小于等于3的所有版本
}
Response:
{
  "code": 200,
  "deletedCount": 3,
  "message": "成功删除3个版本"
}
```

---

## 四、插件端数据流

```
┌────────────────────────────────────────────────────────┐
│                    Chrome Extension                     │
│                                                        │
│  ① 打开插件 → 选择「链路管理」Tab                       │
│     → GET /api/plugin/chain/list                       │
│       ↓                                                │
│  ② 搜索/筛选 → 更新列表                                │
│       ↓                                                │
│  ③ 选中链路 → GET /api/plugin/chain/detail              │
│       ↓                                                │
│  ④ 选择回放模式：                                       │
│     ┌─────────────┐  ┌─────────────────┐              │
│     │ HTTP 回放    │  │ 浏览器回放       │              │
│     │ 顺序发送请求 │  │ 打开页面+捕获   │              │
│     └──────┬──────┘  └────────┬────────┘              │
│            │                  │                        │
│     ┌──────┴──────────────────┴────────┐              │
│     │        收集新的请求/响应数据       │              │
│     └──────────────┬───────────────────┘              │
│                    ↓                                   │
│  ⑤ 回放完成 → 展示结果汇总                             │
│       ↓                                                │
│  ⑥ 用户选择接口 → POST /api/plugin/chain/replay/push   │
│       ↓                                                │
│  ⑦ 后端创建新版本 + 计算 Diff + AI 分析                 │
│       ↓                                                │
│  ⑧ 返回 Diff 结果 → 插件展示变更摘要                    │
│       ↓                                                │
│  ⑨ 打开平台链接 → 前端查看详细 Diff + AI 建议           │
└────────────────────────────────────────────────────────┘
```

---

## 五、后端核心逻辑

### 5.1 版本创建流程

```
接收插件推送的 replayNodes
  ↓
生成 chain_fingerprint
  ↓
查找是否已存在相同指纹的链路
  ├── 存在 → 取当前版本号 +1
  └── 不存在 → 创建新链路，版本号 = 1
  ↓
保存 test_chain_version（node_snapshot JSON）
  ↓
保存 test_node_snapshot（每条接口明细）
  ↓
计算与上一版本的 Diff（如果有上一版本）
  ↓
调用 AI 分析 Diff 影响
  ↓
更新 test_chain.current_version 和 chain_fingerprint
  ↓
返回 Diff 结果 + AI 分析给插件
```

### 5.2 版本查询策略

```java
// 默认只返回最近5个版本
public List<VersionVO> getVersions(String chainCode, boolean all) {
    if (all) {
        return versionMapper.selectAllByChainCode(chainCode);
    } else {
        return versionMapper.selectRecentByChainCode(chainCode, 5);
    }
}

// 版本数超过30时提示清理
public void checkVersionCount(String chainCode) {
    int count = versionMapper.countByChainCode(chainCode);
    if (count > 30) {
        // 返回提示信息
    }
}
```
