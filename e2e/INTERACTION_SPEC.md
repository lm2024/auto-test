# 交互规范文档 (Interaction Spec) — Playwright E2E 覆盖目标

> 本文件为 **只读研究产出**，不修改任何源码。
> 覆盖目标：9 个文件（4 个视图 + 5 个组件）。
> 每个元素均标注**精确可见中文文案 / 角色**、`v-model` 绑定名、输入类型、对应 `line` 行号、以及触发的 API。
> 注意：所有 `api.*` 调用来自 `frontend/src/api` 封装（相对 baseURL，通常带 `/api` 前缀）；`axios.get('/api/...')` 直连，路径已标注。

---

## 1. PluginDownload.vue（插件下载页）

**文件绝对路径**: `frontend/src/views/PluginDownload.vue`
**用途**: 浏览器插件介绍与下载。几乎纯静态展示页，仅 1 个交互按钮。

### 1.1 交互元素
| 可见文案 | 角色 | 行号 | 事件 | 说明 |
|---|---|---|---|---|
| `下载插件 (.crx)` | `el-button` (type=primary, size=large) | L35-38 | `downloadPlugin` | 通过 JS 创建 `<a>`，`href='/plugin-test.crx'`，`download='traceflow-plugin.crx'`，触发浏览器下载。**不调用后端 API** |

### 1.2 表单字段
- 无表单、无 `v-model`。

### 1.3 对话框
- 无 `el-dialog`。

### 1.4 API 端点
- 无。下载为静态资源 `/plugin-test.crx`。

### 1.5 确认框
- 无。

### 1.6 校验规则
- 无。

### 1.7 特殊 UI / 备注
- 静态说明区块：标题 `浏览器插件`(L6)、`捉接口 TraceFlow`(L14)、版本 `v1.1.0`(L15)、`支持的浏览器`(L23)、`下载安装`(L34)、`更新日志`(L53) 时间线。
- 安装步骤为有序列表（L41-46），含文案 `chrome://extensions` 等。
- **测试要点**：断言「下载插件 (.crx)」按钮存在并可点击；可用 Playwright 监听 `download` 事件校验文件名 `traceflow-plugin.crx`。

---

## 2. ExecuteList.vue（执行记录查询页）

**文件绝对路径**: `frontend/src/views/ExecuteList.vue`
**用途**: 执行记录列表 + 筛选 + 分页。

### 2.1 交互元素
| 可见文案 | 角色 | 行号 | 事件 | 说明 |
|---|---|---|---|---|
| `链路编码` (placeholder) | `el-input` | L11 | `v-model="filter.chainCode"` | 文本输入 |
| `执行状态` (placeholder) | `el-select` | L12-16 | `v-model="filter.status"` | 下拉，clearable。选项：`运行中`(RUNNING)/`成功`(SUCCESS)/`失败`(FAILED) |
| 开始日期 / 结束日期 | `el-date-picker` type=daterange | L17-18 | `v-model="dateRange"` | 范围选择 |
| `选择分类` 或 `已选分类` | `el-button` (ref of popover) | L21-23 | 打开 `el-popover` | 内含 `CategoryTree`(mode=select) |
| `查询` | `el-button` (type=primary) | L27 | `loadRecords` | 触发列表刷新 |
| `详情` | `el-button` (size=small, 表格操作列) | L54 | `$router.push('/execute/detail/'+row.executionId)` | 跳转详情 |

### 2.2 表单字段 / 绑定
- `filter` 对象 (ref, L81): `{ chainCode:'', status:'', categoryId:null }`
- `dateRange` (ref, L82): `null`
- `pageNo` (ref, L83, 默认 1)、`pageSize` (ref, L84, 默认 10)

### 2.3 表格列 (L30-57)
- `执行ID`(prop executionId)、`关联链路`(prop chainName)、`状态`(tag)、`开始时间`、`总耗时`、`节点统计`(成功/失败/跳过)、`操作`(详情按钮)。

### 2.4 分页
- `el-pagination` (L61-69): `v-model:current-page="pageNo"`、`v-model:page-size="pageSize"`、`page-sizes=[10,20,50,100]`、`layout="total, sizes, prev, pager, next, jumper"`，`@size-change`/`@current-change` 均调 `loadRecords`。

### 2.5 对话框
- 无 `el-dialog`。

### 2.6 API 端点
| 方法 | 路径 | 行号 | 参数 / payload | 响应处理 |
|---|---|---|---|---|
| GET | `/execute/list` | L94 | `params: { ...filter, pageNo, pageSize, startTime, endTime }`（若 dateRange 有值；categoryId 为空则 delete） | `records.value = res.data?.list`，`total.value = res.data?.total` |

### 2.7 确认框
- 无 `ElMessageBox`。

### 2.8 校验规则
- 无必填校验（所有筛选可空）。

### 2.9 测试要点
- 进入页面即 `onMounted(loadRecords)` (L103) 自动加载。
- `选择分类` 弹出 `el-popover` → `CategoryTree` 选取后回填 `filter.categoryId`，按钮文案变 `已选分类`。
- 验证分页 `page-sizes` 切换与 `查询` 按钮。

---

## 3. ExecuteDetail.vue（执行详情页）

**文件绝对路径**: `frontend/src/views/ExecuteDetail.vue`
**用途**: 展示单次执行的主信息、节点日志（平铺/分组两视图）、节点详情弹窗、AI 失败分析。含 **WebSocket** 实时更新。

### 3.1 交互元素（工具栏）
| 可见文案 | 角色 | 行号 | 事件 | 说明 |
|---|---|---|---|---|
| `返回` | `el-button` | L4 | `$router.back()` | 返回上一页 |
| `平铺视图` | `el-button` (in button-group) | L14 | `viewMode='flat'` | 高亮当 type=primary |
| `分组视图` | `el-button` (in button-group) | L15 | `viewMode='trace'` | 高亮当 type=primary |

### 3.2 平铺视图节点卡片 (v-if viewMode==='flat', L20-37)
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `查看详情` | `el-button` (size=small) | L33 | `showDetail(log)` → 打开「节点详情」弹窗 |
| `AI分析失败原因` | `el-button` (size=small, type=warning, 仅 `log.status==='FAILED'`) | L34 | `analyzeFailure(log)` → 打开「AI分析结果」弹窗 + POST |

### 3.3 分组视图 (v-if viewMode==='trace', L40-67)
- 按 `bizOperTraceId` 分组 (computed `traceLogGroups`, L163-175)。
- 每组头部：tag `TraceId` + traceId + 状态 tag + 耗时 + `N 个节点`。
- 节点卡片只读展示（点击无独立事件，仅展示）。

### 3.4 弹窗 1：节点详情 (el-dialog)
| 项 | 值 | 行号 |
|---|---|---|
| title | `节点详情` | L69 |
| width | `700px` | L69 |
| v-model | `detailVisible` | L69 |
| 内容 | `el-descriptions`：节点编码/状态/请求方法/响应码/耗时；`请求头`(readonly textarea L80)、`复制`按钮(L81)；`请求体`(L84)+`复制`(L85)；`响应体`(L88)+`复制`(L89)；`错误信息`(L91-92) | L70-93 |
| 按钮 | **无 确定/取消**；仅有 3 个 `复制`（各自 `copyText`）按钮 | L81,85,89 |

> 复制按钮文案均为 `复制`，共 3 处（请求头/请求体/响应体）。`copyText` 用 `navigator.clipboard.writeText`。

### 3.5 弹窗 2：AI分析结果 (el-dialog)
| 项 | 值 | 行号 |
|---|---|---|
| title | `AI分析结果` | L96 |
| width | `650px` | L96 |
| 属性 | `:close-on-click-modal="false"` | L96 |
| v-model | `aiVisible` | L96 |
| 状态 | `aiLoading` 显示「正在分析失败原因...」(L97-100)；`aiResult` 展示 根因定位/排查步骤/修复方案；空态「分析失败，请稍后重试」(L133-136) | |
| 按钮 | `复制全部` (size=small, `:icon="DocumentCopy"`) | L130 |

### 3.6 绑定 / 响应式
- `mainInfo`(L151)、`nodeLogs`(L152)、`detailVisible`(L153)、`currentLog`(L154)、`aiVisible`(L155)、`aiResult`(L156)、`aiLoading`(L157)、`viewMode`(默认 'flat', L158)。

### 3.7 API 端点
| 方法 | 路径 | 行号 | 参数 / payload | 响应处理 |
|---|---|---|---|---|
| GET | `/execute/status` | L198 | `params:{ executionId }` (来自 `route.params.executionId`, L149) | `mainInfo.value = res.data` |
| GET | `/execute/nodeLogs` | L200 | `params:{ executionId }` | `nodeLogs.value = res.data` |
| POST | `/ai/failure/analyze` | L233 | `{ executionId, nodeCode: log.nodeCode }` | `aiResult.value = res.data`；异常 `ElMessage.error('分析失败: ...')` |

### 3.8 WebSocket
- `connectWs()` (L204-221): `ws://${location.host}/ws/execute/${executionId}`。
- 消息 `NODE_STATUS` → 更新对应 node 的 status/costMs。
- 消息 `CHAIN_STATUS` → 重新 `loadData()`。
- `onclose` → 3 秒后自动重连；`onUnmounted` 关闭 (L252)。

### 3.9 确认框
- 无 `ElMessageBox`。

### 3.10 校验 / 状态映射
- `statusType`/`statusText` 映射 (L248-249): RUNNING→运行中(warning), SUCCESS→成功(success), FAILED→失败(danger), SKIPPED→跳过(info), PENDING→待执行。
- `groupStatus*` 分组状态 (L177-191): 有失败→失败/危险；全成功→成功；否则→部分成功/警告。

### 3.11 测试要点
- 必须覆盖 WebSocket：Playwright 可监听 `ws://**/ws/execute/*` 并 mock/stub 消息。
- `AI分析失败原因` 仅在 FAILED 节点出现（需构造失败记录才能点到）。

---

## 4. ChainEdit.vue（链路编排编辑页 — 最大文件）

**文件绝对路径**: `frontend/src/views/ChainEdit.vue`
**用途**: 链路节点的可视化编排（列表视图 / TraceId 分组视图）、右侧属性配置面板、版本对比、批量导入、执行、AI 生成数据。drag-drop 排序。

### 4.1 工具栏 (toolbar-left)
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `返回` (icon ArrowLeft) | `el-button` | L5 | `$router.back()` |
| `链路编排` | 纯文本 span | L7 | — |
| (版本下拉) placeholder `选择版本` | `el-select` `v-model="currentVersion"` | L9-11 | `@change="onVersionChange"`；选项 `v{version}`；clearable |
| diff badge: `新增 N` / `删除 N` / `修改 N` / `未变 N` | span | L13-16 | 来自 `diffSummary` |

### 4.2 工具栏 (toolbar-right)
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `列表视图` (icon List) | `el-button` (in button-group) | L21-22 | `viewMode='list'` |
| `分组视图` (icon Connection) | `el-button` (in button-group) | L24-26 | `viewMode='trace'; loadTraceGroups()` |
| `撤销` (icon RefreshLeft) | `el-button` `:disabled="!canUndo"` | L28 | `undo()` → `ElMessage.info('撤销')` |
| `重做` (icon RefreshRight) | `el-button` `:disabled="!canRedo"` | L29 | `redo()` → `ElMessage.info('重做')` |
| `自动布局` (icon Grid) | `el-button` | L30 | `autoLayout()` → `ElMessage.success('已自动布局')` |
| `AI生成测试数据` (icon MagicStick) | `el-button` type=warning `:loading="aiLoading"` | L32 | `generateTestData()` → POST |
| `执行` (icon CaretRight) | `el-button` type=success `:disabled="nodes.length===0"` | L33 | `executeChain()` → POST → 跳转 |
| `保存` (icon Check) | `el-button` type=primary | L34 | `saveAll()` → 循环 POST /node/edit |

### 4.3 左面板 — 节点库
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `节点库` 标题 | span | L42 | — |
| `HTTP请求` 拖拽项 | div draggable | L45-51 | `@dragstart="onDragStart"` (setData 'httpNode')；拖到画布 `@drop="onDrop"` → POST /node/create |
| `批量导入` (icon Upload) | `el-button` type=primary plain | L52 | `openImportDialog()` → 打开导入弹窗 |

### 4.4 左面板 — 节点列表
- `节点列表` 标题 + 节点计数 tag (L58-62)。
- 每个节点项 div (L64-75): draggable，`@click="selectNode(node)"`、`@dragstart="onListDragStart"`、`@drop="onListDrop"`。含 method tag + 名称。
- 空态 `暂无节点` (L76)。

### 4.5 左面板 — VersionHistory 组件
- `<VersionHistory :chainCode :selectedVersion @select-version="onVersionChange" />` (L81)，仅当 `chainCode` 存在 (v-if, L80)。

### 4.6 中央面板 — 列表视图画布 (viewMode==='list', L128-180)
- 空画布 `拖拽节点到此处` / `或点击左侧「批量导入」添加接口` (L129-133)，可 drop。
- 节点卡片 `node-card` (L135-171)：点击 `selectNode`；拖拽排序 (`onNodeDragStart/Drop`)；`bodyType==='file'` 显示 `文件上传`(L164)；`bodyData` 存在显示 `已填充测试数据`(L168)。
- 连接箭头分隔 (L172-175)。
- `新增节点` (icon Plus) 按钮 (L178) → `addNode()` → POST /node/create。

### 4.7 中央面板 — 分组视图 (viewMode==='trace', L89-126)
- 空态 `暂无分组数据` / `链路节点未携带 bizOperTraceId 信息` (L91-93)。
- 每个 trace 组卡片：header (TraceId tag + id + triggerEvent tag + pageUrl + `N 个节点` tag)；节点卡片点击 `selectNode`；忽略态 `已忽略` (L118)。
- `执行此分组` (icon, type=primary plain) 按钮 (L123) → `runTraceGroup(group.traceId)` → POST /chain/runByTrace → 跳转。

### 4.8 右面板 — 属性配置 (selectedNode 存在时, L185-471)
- 头部 `属性配置` + 关闭按钮 `el-button text` (icon Close, L192) → `selectedNode=null`。
- `el-tabs v-model="activeTab"` (L195)，初始 'basic'。标签页：
  - `基础信息` (name=basic, L196)
  - `请求配置` (name=request, L218)
  - `提取规则` (name=extract, L328)
  - `断言规则` (name=assert, L366)
  - `差异对比` (name=diff, 仅当 `diffData && diffData.nodes`, L446)

#### 4.8.1 基础信息 tab
| 标签 | 绑定 | 类型 | 行号 |
|---|---|---|---|
| 节点名称 | `selectedNode.nodeName` | input (clearable) | L199 |
| 排序号 | `selectedNode.sortNo` | input-number (`:min="1"`) | L203 |
| 并行分组 | `selectedNode.parallelGroup` | input (placeholder 为空则串行) | L207 |
| 等待时间 | `selectedNode.delaySeconds` | input-number (`:min="0" :max="3600"`) | L212 |

#### 4.8.2 请求配置 tab
| 标签 | 绑定 | 类型 | 行号 |
|---|---|---|---|
| 请求方法 | `selectedNode.requestMethod` | select | L221-227：GET/POST/PUT/DELETE/PATCH |
| URL | `selectedNode.requestUrl` | input | L231 |
| 请求体类型 | `selectedNode.bodyType` | radio-group | L240-244：`JSON`(json)/`文件上传`(file)/`Form Data`(form) |
| — json 分支 — 请求头 | `selectedNode.requestHeaders` | textarea :rows=3 | L250；旁 `格式化`(L253)/`复制`(L254) text 按钮 |
| — json 分支 — 请求体 | `selectedNode.bodyData` | textarea :rows=8 (class code-editor) | L259；旁 `格式化`(L262)/`复制`(L263) |
| — file 分支 — 文件上传 | `el-upload` (auto-upload, action `/api/upload/file`) | upload drag | L272-287；accept 多类型，`:limit="1"`；成功 `handleFileUploadSuccess`，错误 `handleFileUploadError`，`beforeFileUpload` 校验 ≤50MB |
| — file 分支 — 移除 | `el-button` type=danger text (icon Delete) | L296 | `removeUploadedFile()` |
| — file 分支 — 请求头 | `selectedNode.requestHeaders` | textarea :rows=3 | L306 |
| — form 分支 — 请求头 | `selectedNode.requestHeaders` | textarea :rows=3 | L314；`格式化`(L317) |
| — form 分支 — Form Data | `selectedNode.bodyData` | textarea :rows=6 | L322 |

#### 4.8.3 提取规则 tab (name=extract)
- `添加提取规则` (icon Plus, type=primary plain) 按钮 L360 → `addExtractRule()`。
- 每条规则 (v-for `extractRuleList`, L335-359):
  - `变量名称` → `rule.varName` (input, L343)
  - `提取路径` → `rule.jsonPath` (input, L347)
  - 快捷 tag：`$.data.id`/`$.data.token`/`$.data.items[0].name`/`$.data.list.length` (L353-356，点击写 jsonPath)
  - 删除按钮 `el-button text type=danger` (icon Delete, L338) → `removeExtractRule(idx)`

#### 4.8.4 断言规则 tab (name=assert)
- 状态码检查组：
  - 比较方式 select `assertStatusMode` (L381-385): `等于`(eq)/`不等于`(ne)/`在范围内`(in)
  - 值 input `assertStatusCode` (L388)
  - 快捷 tag：`200 成功`/`201 创建`/`400 参数错误`/`401 未授权`/`404 不存在`/`500 服务器错误` (L392-397)
- 响应体字段检查组 (v-for `assertBodyRules`, L406-438):
  - `字段路径` → `rule.path` (input, L414)
  - `比较方式` select `rule.operator` (L418-425): `等于`/`不等于`/`包含`/`大于`/`小于`/`不为空`
  - `期望值` → `rule.expected` (input, `:disabled="operator==='notNull'"`, L429)
  - 快捷 tag：`$.code`/`$.message`/`$.data.id`/`$.data.list.length` (L433-437)
  - 删除 `el-button text danger` (icon Delete, L409) → `removeAssertBodyRule(idx)`
  - `添加字段检查` (icon Plus, type=primary plain) 按钮 L439 → `addAssertBodyRule()`

#### 4.8.5 差异对比 tab (name=diff)
- 变更状态 tag（来自 `getNodeDiffType`），`无对比数据` 兜底 (L450-453)。
- `<FieldDiff :changes="getNodeFieldChanges(selectedNode)" />` (L456) 显示字段级差异。
- `<AiAnalysis :analysis="diffData.aiAnalysis" />` (L460) 显示 AI 差异分析。

#### 4.8.6 面板底部 (panel-footer, L464-470)
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `上移` (icon Top) | `el-button` `:disabled="isFirstNode"` | L465 | `moveNodeUp()` → 调 `saveAll()` |
| `下移` (icon Bottom) | `el-button` `:disabled="isLastNode"` | L466 | `moveNodeDown()` → 调 `saveAll()` |
| `保存节点` (icon Check) | `el-button` type=primary | L468 | `saveNode()` → POST /node/edit |
| `删除节点` (icon Delete) | `el-button` type=danger | L469 | `deleteNode()` → POST /node/delete |

### 4.9 对话框：批量导入接口 (el-dialog title="批量导入接口", width=750px, L484-560)
- `:close-on-click-modal="false"` (L484)。
- `el-tabs v-model="importTab"` (L485)，初始 'swagger'：
  - **Swagger/OpenAPI** (name=swagger, L486-504):
    - `API文档URL` 输入框 → `v-model="swaggerUrl"` (L489)
    - `解析并导入` (type=primary, `:loading="importLoading"`) → `importFromSwagger()` (L492)
    - 解析结果表（多选列 + 名称/方法/URL）(L497-502)
    - `确认导入选中` (type=primary) → `confirmSwaggerImport()` → POST /node/import (L503)
  - **JSON文件** (name=json, L507-531):
    - `el-upload` (`:auto-upload="false"`, `@on-change="handleJsonFile"`, accept .json) (L508-521)
    - 预览表 + `确认导入选中` → `confirmJsonImport()` → POST /node/import (L530)
  - **cURL命令** (name=curl, L534-540):
    - textarea `v-model="curlCommand"` (L535)
    - `解析并导入` (`:loading="importLoading"`) → `importFromCurl()` → POST /node/import (L539)
  - **直接粘贴JSON** (name=paste, L542-554):
    - textarea `v-model="pasteJson"` (L543)
    - `解析并导入` (`:loading="importLoading"`) → `importFromPaste()` → POST /node/import (L553)
- footer: `取消` 按钮 (L558) → `importDialogVisible=false`。**注意：此弹窗无「确定」统一按钮，各 tab 用各自「确认导入选中/解析并导入」。**

### 4.10 API 端点汇总 (ChainEdit)
| 方法 | 路径 | 行号 | 参数 / payload | 响应处理 |
|---|---|---|---|---|
| GET | `/node/list` | L805 | `params:{ chainCode }` | `nodes.value = res.data` |
| GET | `/chain/trace-groups` | L812 | `params:{ chainCode }` | `traceGroups.value = res.data` |
| POST | `/chain/runByTrace` | L821 | `null`, `params:{ chainCode, traceId, parallel:false }` | `executionId=res.data.executionId` → 跳转 `/execute/detail/{id}` |
| POST | `/node/edit` | L977, L993 | `{ ...selectedNode }` (del `_uploadedFile`)；`saveAll` 循环每条 | `ElMessage.success('保存成功'/'全部保存成功')` → `loadNodes()` |
| POST | `/node/delete` | L983 | `null`, `params:{ id: selectedNode.id }` | `ElMessage.success('删除成功')` → `loadNodes()` |
| POST | `/node/create` | L1006, L1015 | `{ chainCode, nodeName:'新节点', requestMethod:'GET', requestUrl:'http://' }` | → `loadNodes()`；`addNode` 另 `ElMessage.success('已新增节点')` |
| POST | `/node/import` | L1068, L1131, L1145, L1199 | `{ chainCode, interfaces:[{nodeName,method,url,headers,bodyData,sort,parallelGroup}] }` | `ElMessage.success(...)` → 关弹窗 + `loadNodes()` |
| POST | `/ai/data/generate` | L1224 | `{ chainCode, idGenerateMode:'AUTO_INCREMENT', idStep:1 }` | `res.data.nodeData` 写回各节点 bodyData，必要时 `saveAll()` |
| POST | `/execute/run` | L1248 | `{ chainCode }` | `executionId=res.data.executionId` → 跳转 |
| GET | `/chain/versions` | L1257 | `params:{ chainCode, all:'false' }` | `versions.value = data.data.list` |
| GET | `/chain/version/diff` | L1276 | `params:{ chainCode, version }` | `diffData.value=data.data`, `diffSummary.value=data.data.summary` |
| (文件上传) POST | `/api/upload/file` | L276 | `el-upload` action, `:data:{ nodeCode }` | `handleFileUploadSuccess`: `bodyData=res.data.fileId` |

### 4.11 确认框
- 无 `ElMessageBox.confirm`（删除节点走直接 POST，无二次确认）。

### 4.12 校验规则
- `beforeFileUpload` (L958): 文件 > 50MB → `ElMessage.error('文件大小不能超过50MB')` 并拦截。
- `importFromSwagger` (L1033): 空 `swaggerUrl` → `ElMessage.warning('请输入Swagger URL')`。
- `importFromCurl` (L1138): 空 → `ElMessage.warning('请输入cURL命令')`。
- `importFromPaste` (L1183): 空 → `ElMessage.warning('请粘贴JSON数据')`。
- `generateTestData` (L1218): `nodes.length===0` → `ElMessage.warning('请先添加节点')`。
- `formatJson` (L921): JSON 解析失败 → `ElMessage.warning('JSON格式错误')`。
- 无 el-form 级 `rules`，校验均为 JS 判断 + `ElMessage`。

### 4.13 特殊 UI / 备注
- **拖拽排序**：节点库→画布 (`onDragStart`/`onDrop`)、列表内 (`onListDragStart`/`onListDrop`)、画布卡片 (`onNodeDragStart`/`onNodeDrop`)。
- **面板缩放**：左/右 resizer (`startResizeLeft`/`startResizeRight`，L86, L183, L597-645)。
- 无 LogicFlow / Monaco（代码编辑仅为普通 `el-input` textarea，class `code-editor` 仅样式）。
- 无 WebSocket（WS 仅存在于 ExecuteDetail）。

---

## 5. CategoryTree.vue（分类树组件）

**文件绝对路径**: `frontend/src/components/CategoryTree.vue`
**用途**: 分类树，支持 `select`(选择) 与 `manage`(管理) 两种模式。

### 5.1 模式与交互
| mode | 行为 | 行号 |
|---|---|---|
| `select` (默认) | 仅选中节点 emit `update:modelValue` | L48, L84-86 |
| `manage` | 显示搜索框 + 新增根分类；节点 hover 显示 编辑/删除/+；树可拖拽排序 | L3-15, L23, L33-35 |

### 5.2 manage 模式交互元素
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `搜索分类...` (placeholder) | `el-input` `v-model="searchKeyword"` | L4-11 | `@input="filterTree"` |
| `新增根分类` | `el-button` type=primary size=small | L12 | `$emit('addRoot')` |
| `+` (加子节点) | `el-button link type=primary` | L33 | `$emit('add-child', data)` |
| `编辑` | `el-button link type=primary` | L34 | `$emit('edit', data)` |
| `删除` | `el-button link type=danger` | L35 | `$emit('delete', data)` |

### 5.3 select 模式
- 点击节点 → `handleNodeClick` → `emit('update:modelValue', data.id)` (L84-86)。ExecuteList 中通过 `v-model="filter.categoryId"` 接收 (L25)。

### 5.4 API 端点
| 方法 | 路径 | 行号 | 参数 / payload | 响应处理 |
|---|---|---|---|---|
| GET | `/category/tree` | L77 | 无 | `treeData.value = res.data` |
| PUT | `/category/sort` | L98 | `{ parentId, items:[{id, sortOrder}] }` | 拖拽 drop 后调用；成功 `emit('refresh')`，失败回滚 `loadTree()` |

### 5.5 确认框
- 无（删除走 `emit('delete')`，由父组件处理；本组件不直接调 `ElMessageBox`）。

### 5.6 校验
- `allowDrop` (L88-91): 仅允许 inner 或同父级兄弟间 drop。

---

## 6. AiAnalysis.vue（AI 差异分析展示组件）

**文件绝对路径**: `frontend/src/components/AiAnalysis.vue`
**用途**: 纯展示组件，接收 `analysis` prop，渲染 AI 差异分析内容。无交互、无 API。

### 6.1 交互元素
- 无按钮、无表单、无对话框。

### 6.2 展示区块 (props.analysis 字段)
- 标题 `AI 差异分析` (L4-5)。
- `变更摘要` (L8-11, `analysis.summary`)。
- `潜在影响` 列表 (L12-16, `analysis.impacts[]`)。
- `测试建议` 列表 (L18-23, `analysis.suggestions[]`)。
- 整块外层 `v-if="analysis"` (L2) — analysis 为空则不渲染。

### 6.3 API / 确认框 / 校验
- 均无。

### 6.4 备注
- 在 ChainEdit 差异对比 tab 内使用：`<AiAnalysis :analysis="diffData.aiAnalysis" />` (ChainEdit L460)。

---

## 7. VersionHistory.vue（版本历史组件）

**文件绝对路径**: `frontend/src/components/VersionHistory.vue`
**用途**: 展示某链路版本列表，点击切换版本。用 `axios` 直连（非 `api` 封装）。

### 7.1 交互元素
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `版本历史` | span 标题 | L4 | — |
| `加载全部` | `el-button` size=small text (仅 `versions.length>=5`) | L5-7 | `loadVersions(true)` |
| 版本项 `v{version}` | div.history-item `:class="{active: selectedVersion===v.version}"` | L10-24 | `@click="$emit('select-version', v.version)"` |
| diff badge | `+N`/`-N`/`~N` (来自 `v.diffSummary`) | L19-23 | 仅展示 |
| `暂无版本记录` | 空态 | L25 | — |

### 7.2 API 端点
| 方法 | 路径 | 行号 | 参数 | 响应处理 |
|---|---|---|---|---|
| GET | `/api/chain/versions` (axios 直连) | L51 | `params:{ chainCode, all:'true'/'false' }` | `versions.value = data.data.list` |

> 注意：与 ChainEdit 内 `loadVersions` 调 `/chain/versions` 不同，本组件走 `/api/chain/versions`（多 `/api` 前缀，axios 直连）。两者都接受 `{chainCode, all}`。

### 7.3 确认框 / 校验
- 无。

### 7.4 备注
- emit `select-version`；在 ChainEdit 中 `@select-version="onVersionChange"` (ChainEdit L81) → 触发 `/chain/version/diff`。

---

## 8. FieldDiff.vue（字段差异展示组件）

**文件绝对路径**: `frontend/src/components/FieldDiff.vue`
**用途**: 纯展示组件，接收 `changes` 数组，渲染字段旧值/新值对比。无交互、无 API。

### 8.1 交互元素
- 无按钮、无表单、无对话框。

### 8.2 展示区块 (props.changes 每项)
- 空态 `无字段变化` (icon Check, L3-6)。
- 每项 `change` (L7-19):
  - `change.label` 字段名 (L8)。
  - 旧值块 `旧值` + `formatValue(change.oldValue)` (L10-13)。
  - 新值块 `新值` + `formatValue(change.newValue)` (L14-17)。
- `formatValue` (L30-40): null/undefined→`(空)`；字符串尝试 JSON 美化，否则原样。

### 8.3 API / 确认框 / 校验
- 均无。

### 8.4 备注
- 在 ChainEdit 差异对比 tab 内使用：`<FieldDiff :changes="getNodeFieldChanges(selectedNode)" />` (ChainEdit L456)。

---

## 9. VersionSelector.vue（版本选择器组件）

**文件绝对路径**: `frontend/src/components/VersionSelector.vue`
**用途**: 顶栏版本选择 + diff 摘要徽章。用 `axios` 直连。

### 9.1 交互元素
| 可见文案 | 角色 | 行号 | 事件 |
|---|---|---|---|
| `版本:` | span 标签 | L4 | — |
| (版本下拉) placeholder `选择版本` | `el-select` `v-model="currentVersion"` | L5-12 | `@change="onVersionChange"`；选项 `v{version} — {createTime}` |
| `查看全部 (N)` (仅 `versions.length>5`) | `el-button` size=small text | L13-15 | `loadAllVersions()` |
| diff badge | `新增 N`(Plus)/`删除 N`(Minus)/`修改 N`(Edit)/`未变 N`(Check) | L17-34 | 仅展示 `diffSummary` |

### 9.2 API 端点
| 方法 | 路径 | 行号 | 参数 | 响应处理 |
|---|---|---|---|---|
| GET | `/api/chain/versions` (axios) | L66 | `params:{ chainCode, all }` | `versions.value=data.data.list`, `totalVersions=data.data.total` |
| GET | `/api/chain/version/diff` (axios) | L92 | `params:{ chainCode, version }` | `diffSummary.value=data.data.summary`；emit `version-change`/`diff-loaded` |
| (版本<=1 不调 diff) | — | L86-90 | — | `diffSummary=null` |

> 注意：版本号 ≤ 1 时跳过 diff 请求（L86）。

### 9.3 确认框 / 校验
- 无。

### 9.4 emits
- `version-change`(version)、`diff-loaded`(data) (L48)。

---

## 10. API 端点速查表（按方法）

| 方法 | 路径 | 触发文件 | 触发动作 |
|---|---|---|---|
| GET | `/execute/list` | ExecuteList | `查询`/分页/onMounted |
| GET | `/execute/status` | ExecuteDetail | onMounted/WS CHAIN_STATUS |
| GET | `/execute/nodeLogs` | ExecuteDetail | onMounted |
| POST | `/ai/failure/analyze` | ExecuteDetail | `AI分析失败原因` |
| GET | `/node/list` | ChainEdit | onMounted/`saveNode`等 |
| GET | `/chain/trace-groups` | ChainEdit | `分组视图` |
| POST | `/chain/runByTrace` | ChainEdit | `执行此分组` |
| POST | `/node/edit` | ChainEdit | `保存`/`保存节点`/`上移`/`下移` |
| POST | `/node/delete` | ChainEdit | `删除节点` |
| POST | `/node/create` | ChainEdit | 拖拽到画布/`新增节点` |
| POST | `/node/import` | ChainEdit | 四种导入方式 |
| POST | `/ai/data/generate` | ChainEdit | `AI生成测试数据` |
| POST | `/execute/run` | ChainEdit | `执行` |
| GET | `/chain/versions` | ChainEdit | onMounted |
| GET | `/chain/version/diff` | ChainEdit | 版本切换 |
| POST | `/api/upload/file` | ChainEdit | 文件上传(自带 el-upload) |
| GET | `/category/tree` | CategoryTree | onMounted |
| PUT | `/category/sort` | CategoryTree | 拖拽排序 |
| GET | `/api/chain/versions` | VersionHistory / VersionSelector | onMounted/`加载全部` |
| GET | `/api/chain/version/diff` | VersionSelector | 版本切换(>1) |

---

## 11. 关键可点击文案清单（供选择器断言，逐字引用）
- PluginDownload: `下载插件 (.crx)`
- ExecuteList: `查询`、`详情`、`选择分类`/`已选分类`
- ExecuteDetail: `返回`、`平铺视图`、`分组视图`、`查看详情`、`AI分析失败原因`、`复制`(×3)、`复制全部`
- ChainEdit: `返回`、`列表视图`、`分组视图`、`撤销`、`重做`、`自动布局`、`AI生成测试数据`、`执行`、`保存`、`批量导入`、`HTTP请求`、`新增节点`、`执行此分组`、`属性配置`(关)、`上移`、`下移`、`保存节点`、`删除节点`、`添加提取规则`、`添加字段检查`、`解析并导入`、`确认导入选中`、`取消`、`节点库`、`节点列表`、`版本历史`
- CategoryTree(manage): `搜索分类...`、`新增根分类`、`+`、`编辑`、`删除`
- VersionHistory: `加载全部`、`版本历史`、`暂无版本记录`
- VersionSelector: `查看全部 (N)`、`版本:`
- 弹窗标题: `批量导入接口`、`节点详情`、`AI分析结果`

## 12. 测试注意事项
1. **两套 baseURL 前缀**：`api` 封装（ChainEdit/Execute*/CategoryTree）路径如 `/execute/list`；`axios` 直连（VersionHistory/VersionSelector）路径为 `/api/chain/versions`。Mock 时需分别匹配。
2. **WebSocket**：仅 ExecuteDetail 使用，路径 `ws://{host}/ws/execute/{executionId}`，需 stub 或连真实后端。
3. **无 LogicFlow / Monaco**：ChainEdit 的"画布"是普通 div + 拖拽；代码编辑为 textarea。无需为图形库写特殊选择器。
4. **删除无二次确认**：`删除节点`(ChainEdit) 与分类 `删除`(CategoryTree emit) 均直接调用，无 `ElMessageBox.confirm`。全仓库无 `ElMessageBox.confirm` 用法。
5. **文件上传**：走 `el-upload` 的 `action="/api/upload/file"`，`:auto-upload="true"`，可直接对 action 地址 mock。
6. **导入弹窗无统一确定键**：各 tab 使用各自按钮（`确认导入选中`/`解析并导入`）。
