# AI 驱动浏览器自动化测试 — 任务分解 (TaskList)

## 约定

- **预估工时**：按一人全时投入估算
- **优先级**：P0=核心必须，P1=重要，P2=增强
- **依赖**：标注了前置任务，请按序执行

---

## Phase 1: 基础能力建设（预估 10-12 天）

### 1.1 Maven 依赖引入

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 1.1.1 | 在 `pom.xml` 添加 Playwright Java 依赖 | `backend/pom.xml` | 0.5h | P0 | 无 |
| 1.1.2 | `mvn clean compile` 验证依赖正确性 | — | 0.5h | P0 | 1.1.1 |
| 1.1.3 | 安装 Playwright 浏览器（运行 `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install chromium"`） | — | 1h | P0 | 1.1.2 |

**依赖坐标**：
```xml
<dependency>
    <groupId>com.microsoft.playwright</groupId>
    <artifactId>playwright</artifactId>
    <version>1.44.0</version>
</dependency>
```

### 1.2 数据库表创建

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 1.2.1 | 编写 browser_task 表 DDL | `docker/init.sql` | 0.5h | P0 | 无 |
| 1.2.2 | 编写 browser_task_action 表 DDL | `docker/init.sql` | 0.5h | P0 | 无 |
| 1.2.3 | 编写 browser_execution 表 DDL | `docker/init.sql` | 0.5h | P0 | 无 |
| 1.2.4 | 编写 browser_step_log 表 DDL | `docker/init.sql` | 0.5h | P1 | 无 |
| 1.2.5 | 编写 browser_schedule 表 DDL | `docker/init.sql` | 0.5h | P1 | 无 |
| 1.2.6 | 运行 DDL 初始化数据库 | — | 0.5h | P0 | 1.2.1~1.2.5 |

### 1.3 后端核心引擎

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 1.3.1 | 创建实体类 BrowserAction（DTO） | `backend/.../model/dto/BrowserAction.java` | 1h | P0 | 无 |
| 1.3.2 | 创建实体类 BrowserTask、BrowserExecution、BrowserStepLog | `backend/.../model/entity/` | 2h | P0 | 1.2.1~1.2.5 |
| 1.3.3 | 创建 BrowserConfig 配置类（读取 browser.automation.*） | `backend/.../config/BrowserConfig.java` | 0.5h | P0 | 无 |
| 1.3.4 | 创建 BrowserTaskMapper（XML + Interface） | `backend/.../mapper/` + `resources/mapper/` | 2h | P0 | 1.3.2 |
| 1.3.5 | 创建 BrowserExecutionMapper | `backend/.../mapper/` + `resources/mapper/` | 1h | P0 | 1.3.2 |
| 1.3.6 | 创建 BrowserStepLogMapper | `backend/.../mapper/` + `resources/mapper/` | 1h | P1 | 1.3.2 |
| 1.3.7 | 创建 BrowserAutomationService（Playwright 封装层） | `backend/.../service/BrowserAutomationService.java` | 4h | P0 | 1.1.3 |
| 1.3.8 | 实现 ActionExecutor（核心执行器，支持所有 action 类型） | `backend/.../engine/browser/ActionExecutor.java` | 4h | P0 | 1.3.7 |
| 1.3.9 | 实现 BrowserSessionManager（浏览器会话管理 + 并发控制） | `backend/.../engine/browser/BrowserSessionManager.java` | 3h | P0 | 1.3.7 |
| 1.3.10 | 实现 BrowserTaskService（CRUD + 执行调用） | `backend/.../service/BrowserTaskService.java` | 3h | P0 | 1.3.4~1.3.9 |
| 1.3.11 | 创建 BrowserTaskController（REST API） | `backend/.../controller/BrowserTaskController.java` | 2h | P0 | 1.3.10 |
| 1.3.12 | WebSocket 推送扩展（支持 browser_exec_step 消息类型） | `backend/.../websocket/ExecuteWebSocket.java` | 1h | P1 | 1.3.10 |

**ActionExecutor 需要支持的 11 种操作类型：**

| 操作类型 | 实现来源 | Playwright API |
|---------|---------|---------------|
| `navigate` | Playwright | `page.navigate(url)` |
| `click` | Playwright | `page.locator(selector).click()` |
| `input` | Playwright | `page.locator(selector).fill(value)` |
| `select` | Playwright | `page.locator(selector).selectOption(value)` |
| `check` | Playwright | `page.locator(selector).setChecked(bool)` |
| `submit` | Playwright | `page.locator(selector).press("Enter")` |
| `keypress` | Playwright | `page.locator(selector).press(key)` |
| `wait` | Playwright | `page.waitForTimeout(ms)` |
| `screenshot` | Playwright | `page.screenshot()` |
| `assert` | Playwright | `page.locator(selector).isVisible()` 等 |
| `evaluate` | Playwright | `page.evaluate(jsCode)` |

### 1.4 前端页面

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 1.4.1 | 创建浏览器 API 封装（browser.js） | `frontend/src/api/browser.js` | 1h | P0 | 1.3.11 |
| 1.4.2 | 创建 BrowserTaskList 页面 | `frontend/src/views/BrowserTaskList.vue` | 4h | P0 | 1.4.1 |
| 1.4.3 | 创建 BrowserTaskEditor 页面（步骤拖拽排序 + 增删改） | `frontend/src/views/BrowserTaskEditor.vue` | 8h | P0 | 1.4.1 |
| 1.4.4 | 创建 BrowserExecDetail 页面（步骤状态 + 截图轮播） | `frontend/src/views/BrowserExecDetail.vue` | 6h | P1 | 1.4.1 |
| 1.4.5 | 创建 StepEditor 组件（单个步骤编辑对话框） | `frontend/src/components/StepEditor.vue` | 3h | P0 | 1.4.3 |
| 1.4.6 | 创建 ScreenshotCarousel 组件（截图轮播） | `frontend/src/components/ScreenshotCarousel.vue` | 2h | P1 | 1.4.4 |
| 1.4.7 | 添加路由配置 | `frontend/src/router/index.js` | 0.5h | P0 | 1.4.2~1.4.4 |
| 1.4.8 | 左侧导航菜单添加"浏览器自动化"入口 | `frontend/src/App.vue` | 0.5h | P0 | 1.4.7 |

### 1.5 Phase 1 集成测试

| 编号 | 任务 | 预估工时 | 优先级 | 依赖 |
|------|------|---------|--------|------|
| 1.5.1 | 手动创建 BrowserTask（含5个步骤）并执行 | 1h | P0 | 1.4.8 |
| 1.5.2 | 验证 Playwright 浏览器打开和执行过程 | 1h | P0 | 1.5.1 |
| 1.5.3 | 验证执行记录和步骤日志正确入库 | 0.5h | P0 | 1.5.1 |
| 1.5.4 | 验证 WebSocket 实时推送步骤状态 | 0.5h | P1 | 1.5.1 |
| 1.5.5 | 验证并发执行和多会话管理 | 1h | P1 | 1.5.1 |

---

## Phase 2: AI 能力集成（预估 6-8 天）

### 2.1 AI 脚本生成

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 2.1.1 | 创建 BrowserScriptService | `backend/.../service/BrowserScriptService.java` | 3h | P0 | 1.3.10 |
| 2.1.2 | 实现 ScriptGenerator（SystemPrompt + AI 调用 + 结果解析） | `backend/.../engine/browser/ScriptGenerator.java` | 4h | P0 | 2.1.1 |
| 2.1.3 | 实现 ScreenshotAnalyzer（发送截图给 AI 分析页面状态） | `backend/.../engine/browser/ScreenshotAnalyzer.java` | 3h | P1 | 2.1.1 |
| 2.1.4 | Controller 新增 AI 生成和分析接口 | `backend/.../controller/BrowserTaskController.java` | 1h | P0 | 2.1.2 |

### 2.2 前端 AI 面板

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 2.2.1 | 创建 AiScriptPanel 组件（自然语言输入 + 生成按钮） | `frontend/src/components/AiScriptPanel.vue` | 4h | P0 | 1.4.3, 2.1.4 |
| 2.2.2 | AI 生成结果预览 + 一键应用为步骤 | 在 AiScriptPanel 中实现 | 2h | P0 | 2.2.1 |
| 2.2.3 | AI 分析截图展示（ExecDetail 页面嵌入） | `frontend/src/components/AiAnalysis.vue`（复用现有） | 1h | P1 | 2.1.3 |
| 2.2.4 | 步骤编辑器增加"AI 优化"按钮（选中步骤让 AI 修改参数） | `frontend/src/views/BrowserTaskEditor.vue` | 2h | P2 | 2.2.1 |

### 2.3 Phase 2 集成测试

| 编号 | 任务 | 预估工时 | 优先级 | 依赖 |
|------|------|---------|--------|------|
| 2.3.1 | 测试 AI 生成脚本（各种自然语言输入） | 1h | P0 | 2.2.2 |
| 2.3.2 | 验证生成脚本可直接执行通过 | 1h | P0 | 2.3.1 |
| 2.3.3 | 测试截图分析（正常页面和异常页面） | 1h | P1 | 2.2.3 |
| 2.3.4 | 验证 AI 模型不可用时的降级提示 | 0.5h | P1 | 2.3.1 |

---

## Phase 3: 调度与插件对接（预估 4-6 天）

### 3.1 定时调度

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 3.1.1 | 创建 BrowserSchedule 实体和 Mapper | `backend/.../model/entity/BrowserSchedule.java` + Mapper | 1h | P1 | 1.2.5 |
| 3.1.2 | 实现 BrowserTaskScheduler（动态 cron 注册/取消） | `backend/.../engine/browser/BrowserTaskScheduler.java` | 4h | P1 | 3.1.1 |
| 3.1.3 | Controller 新增定时配置接口 | `backend/.../controller/BrowserTaskController.java` | 1h | P1 | 3.1.2 |
| 3.1.4 | 创建 ScheduleConfig 前端组件（cron 配置弹窗） | `frontend/src/components/ScheduleConfig.vue` | 3h | P1 | 3.1.3 |
| 3.1.5 | 应用启动时自动加载已启用的定时任务 | `BrowserTaskScheduler.java` 中 `@PostConstruct` | 0.5h | P1 | 3.1.2 |
| 3.1.6 | 停止任务时自动取消定时 | `BrowserTaskService.java` | 0.5h | P1 | 3.1.2 |

### 3.2 插件推送对接

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 3.2.1 | Controller 新增插件推送转 BrowserTask 接口 | `backend/.../controller/PluginController.java` | 2h | P1 | 1.3.10 |
| 3.2.2 | 实现 macroAction → BrowserAction 转换器 | `backend/.../engine/browser/ActionConverter.java` | 2h | P1 | 3.2.1 |
| 3.2.3 | 插件侧面板增加"推送到浏览器自动化"按钮 | `plugin-test/sidepanel.js` + `sidepanel.html` | 3h | P1 | 3.2.1 |

### 3.3 批量执行

| 编号 | 任务 | 文件 | 预估工时 | 优先级 | 依赖 |
|------|------|------|---------|--------|------|
| 3.3.1 | Controller 新增批量执行接口（多个 taskCode） | `BrowserTaskController.java` | 1h | P2 | 1.3.10 |
| 3.3.2 | 前端批量选择 + 一键执行 | `BrowserTaskList.vue` | 2h | P2 | 3.3.1 |

### 3.4 Phase 3 集成测试

| 编号 | 任务 | 预估工时 | 优先级 | 依赖 |
|------|------|---------|--------|------|
| 3.4.1 | 测试定时任务注册、触发、取消全流程 | 1h | P1 | 3.1.6 |
| 3.4.2 | 测试插件录制 → 推送到平台 → Playwright 回放全链路 | 2h | P1 | 3.2.3 |
| 3.4.3 | 测试定时任务手动执行不冲突 | 0.5h | P1 | 3.4.1 |
| 3.4.4 | 测试批量执行和结果汇总展示 | 1h | P2 | 3.3.2 |

---

## 汇总

| Phase | 内容 | 文件数 | 预估工时 |
|-------|------|--------|---------|
| Phase 1 | 基础 Playwright 集成 + 执行引擎 + 前端任务管理 | 25+ | 10-12 天 |
| Phase 2 | AI 脚本生成 + 截图分析 + AI 面板 | 8+ | 6-8 天 |
| Phase 3 | 定时调度 + 插件推送 + 批量执行 | 10+ | 4-6 天 |
| **总计** | | **40+** | **20-26 天** |

### 技术债务 / 后续优化

| 编号 | 优化项 | 建议时机 |
|------|--------|---------|
| T1 | 执行过程中可查看实时截图流（WebSocket 推送截图 base64） | Phase 1 后续 |
| T2 | Playwright Trace Viewer 集成（完整录制回放） | Phase 1 后续 |
| T3 | 断言类型丰富（正则匹配、数值比较、JSON 路径） | Phase 2 后续 |
| T4 | AI 自动修复失败脚本（分析失败原因 + 修改选择器） | Phase 2 后续 |
| T5 | 执行报告导出（PDF/HTML） | Phase 3 后续 |
| T6 | 多浏览器并行执行（Chromium + Firefox 同时跑） | 全部上线后 |
