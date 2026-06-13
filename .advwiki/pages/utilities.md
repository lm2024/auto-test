---
type: reference
project: auto-test
tags: [backend, utility, helper]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 工具类 (Utilities)

> 后端工具类汇总：编码生成、JSONPath 处理、占位符替换。

## CodeGenerator

文件: `util/CodeGenerator.java`

静态工具类，生成各类编码。

| 方法 | 返回格式 | 说明 |
|------|----------|------|
| `generateChainCode()` | `CHAIN_XXXXXXXXXX` | 链路编码 (时间戳后6位 + 4位随机十六进制) |
| `generateNodeCode(chainCode, index)` | `NODE_XXXXXXXXXX_X` | 节点编码 (基于链路编码 + 索引) |
| `generateExecutionId()` | `EXEC_XXXXXXXXXX` | 执行 ID (时间戳后6位 + 4位随机十六进制) |

**编码格式**: `PREFIX_` + `System.currentTimeMillis()` 的 substring(5,11) + `ThreadLocalRandom.nextInt(0x10000)` 的十六进制

## JsonPathUtil

文件: `util/JsonPathUtil.java`

JSON 路径处理工具。

| 方法 | 说明 |
|------|------|
| `extractLeafPaths(json, prefix)` | 递归提取 JSON 的所有叶子节点路径 |
| `extractRequestBodyPaths(bodyJson)` | 从请求体 JSON 提取所有叶子路径 |
| `extractResponseLeafPaths(responseJson)` | 从响应 JSON 提取所有叶子路径 |
| `normalizeFieldName(fieldName)` | 标准化字段名 (去除 `$[]` 前缀) |

**示例**:
```
JSON: {"user": {"name": "Alice", "age": 30}}
路径: $.user.name = "Alice", $.user.age = "30"
标准化: "user.name" → "username"
```

**用途**: 变量提取规则 (extractRules) 使用 JSONPath 语法从响应中提取值。

## PlaceholderUtil

文件: `util/PlaceholderUtil.java`

占位符替换工具。

| 方法 | 说明 |
|------|------|
| `replace(template, variables)` | 替换 `${varName}` 占位符 |
| `hasPlaceholder(text)` | 检测文本是否包含占位符 |

**语法**: `${变量名}`

**示例**:
```
模板: "https://api.com/user/${userId}"
变量: { "userId": "123" }
结果: "https://api.com/user/123"
```

**用途**: 节点间变量传递，通过占位符引用前序节点的提取结果。

## 相关

- [[execution-engine]] — 执行引擎中的变量传递
- [[data-models#testnodeconfig]] — 节点配置中的 extractRules 和 variableMapping
