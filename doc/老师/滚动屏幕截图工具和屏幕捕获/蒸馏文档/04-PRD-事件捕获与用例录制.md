# 04 PRD：事件捕获与用例录制（Untitled Test Case）

## 0. 重要结论（先读）

经过对 `2.0.5_0` 全量源码检索，**这个扩展本身并没有“Untitled Test Case”事件录制/回放器**。

证据：
- `edit.bundle.js` 里 `recordEvent` 是一个空方法，`untitled` 只是默认文件名。
- 没有 `stepList`、`eventLog`、`replay` 等用例回放数据结构。
- content bundle 里监听的 DOM 事件都服务于截图、选区、滚动拼接、快捷键和录制标注。

你描述的现象（点击后显示“我的事件”、识别事件类型、可调整顺序、有日志、叫 “Untitled Test Case”）是 **Chrome DevTools 内置 Recorder 面板** 的典型界面：录制用户流，步骤显示为 click/type/scroll 等，可排序，有日志。它不是本扩展的能力。

所以本 PRD 分两部分：
1. 扩展内真实存在的事件相关机制（第 1-3 节）
2. 若要在你自己的插件里实现“用例录制器”，应如何设计（第 4-8 节，完整蓝图）

## 1. 扩展内真实事件机制

### 1.1 区域选择
- `mousedown` / `mousemove` / `mouseup` 绘制选区遮罩
- touch 版：`touchstart` / `touchmove` / `touchend`
- 坐标换算 `pageX/pageY` + devicePixelRatio

### 1.2 滚动截图
- 监听 `scroll` 判断用户是否手动滚动（`userAction`）
- 每屏截图后自动滚动，循环直到页面底部
- `beforeunload` 上报页面重载

### 1.3 键盘快捷键
- `document.body.addEventListener("keydown", ...)` 监听 Ctrl+Shift+key
- `msObj` 配置项控制 visible/selected/entire 三个快捷键

### 1.4 录制标注
- 录制时注入控制栏，监听鼠标移动做高亮（`vtoolbar_highlight_mouse_btn`）、点击高亮（`vtoolbar_highlight_click_btn`）

## 2. 扩展的消息动作清单（内容脚本侧）

| 动作 | 说明 |
| --- | --- |
| `tabCanScroll` | 判断页面可滚动 |
| `init_entire_capture` | 初始化整页截图 |
| `insertRecordDiv` | 注入录制浮层 |
| `prepareCustom` | 区域录制框选 |
| `startCountDown` | 显示倒计时 |
| `pause` / `resume` | 暂停/恢复 |
| `remove-toolbar` / `removeRecordDiv` | 清理 |

## 3. 为什么你看不到“网络请求事件”

DevTools Network 面板显示的是 HTTP 请求；Recorder 面板显示的是 DOM 用户操作。两者的数据源完全不同：

| 面板 | 数据来源 | 展示内容 |
| --- | --- | --- |
| Network | 浏览器网络栈 | URL、method、status、耗时 |
| Recorder | 页面 DOM 事件监听 | click、type、scroll、navigate、等待 |

实现 Recorder 式体验的插件，需要自己做 DOM 事件监听 + 结构化建模，见下文。

## 4. 用例录制器设计蓝图（给你的个人插件）

### 4.1 目标
- 一键开始/停止录制用户操作
- 步骤列表显示：事件类型、目标元素、参数（坐标/文本/按键）
- 步骤可上移/下移/删除/重命名
- 用例可命名（默认 “Untitled Test Case”）
- 可回放，回放时有日志面板
- 支持导出 JSON / 代码

### 4.2 架构

```
content script（录制器）
   │ 捕获 DOM 事件
   ▼
EventRecorder
   │ 生成 selector、序列化事件
   ▼
存储（chrome.storage.local / IndexedDB）
   ▼
popup / options 页（用例管理面板）
   │ 排序、重命名、导出
   ▼
ReplayEngine（注入 content script 回放）
   │ 元素定位、事件派发
   ▼
日志面板（console / UI）
```

### 4.3 事件捕获

监听（`capture` phase 优先，避免被页面 stopPropagation 拦截）：

| 事件 | 建模 |
| --- | --- |
| `click` | `{type:"click", target, x, y}` |
| `dblclick` | 同上 |
| `input` / `change` | `{type:"input", target, value, before}` |
| `keydown` / `keyup` | `{type:"key", key, code, modifiers}` |
| `scroll` | `{type:"scroll", target, x, y}` |
| `wheel` | `{type:"wheel", deltaX, deltaY}` |
| `mousedown` / `mouseup` | 可选，合并为 click |
| `focus` / `blur` | 记录焦点变化 |
| `submit` | 表单提交 |

去抖：`scroll` 与 `mousemove` 必须节流（例如 100ms 合并一次）。

### 4.4 选择器生成

为每个目标元素生成稳定选择器，优先级：
1. `id`（`#id`，且页面内唯一）
2. 数据属性（`[data-testid]`、`[data-qa]`、`[name]`）
3. 语义标签（`button`、`a`、`input[type=submit]`）
4. 路径选择器（`body > div:nth-child(2) > button`）
5. 文本匹配（`button:has-text("登录")`）作为回退

同时保存：
- `tagName`
- `text`（截断 50 字符）
- `href` / `value` / `aria-label`
- `xPath` 或 CSS path

注意：
- 页面动态渲染时，选择器要能在回放时重新命中
- iframe 内事件要记录 `framePath`（逐级 frame index）
- Shadow DOM 要记录 `shadowHostPath` + 内部 path

### 4.5 用例数据模型

```json
{
  "id": "case_1720000000000",
  "name": "Untitled Test Case",
  "url": "https://example.com/login",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "steps": [
    {
      "id": "step_1",
      "order": 1,
      "type": "click",
      "selector": "#username",
      "framePath": [],
      "x": 120, "y": 40,
      "timestamp": 1720000000123
    },
    {
      "id": "step_2",
      "order": 2,
      "type": "input",
      "selector": "#username",
      "value": "admin",
      "timestamp": 1720000000150
    }
  ],
  "settings": {
    "timeout": 10000,
    "speed": 1
  }
}
```

### 4.6 回放引擎

1. 注入回放 content script
2. 依次执行步骤：
   - `navigate`：`location.href` 或 `chrome.tabs.update`
   - 元素定位：`querySelector` + 等待 `MutationObserver` 出现（默认 10s 超时）
   - `click`：`el.dispatchEvent(new MouseEvent("click", {bubbles:true, clientX, clientY}))` 或 `el.click()`
   - `input`：设置 `el.value` + 派发 `input` / `change` 事件（React/Vue 需要 `nativeInputValueSetter` 技巧）
   - `key`：`KeyboardEvent`（key, code, keyCode, modifiers）
   - `scroll`：`el.scrollTo` / `window.scrollTo`
   - `wait`：`setTimeout` / `requestAnimationFrame`
3. 每步结束校验：
   - 元素是否存在
   - 值是否生效
   - 是否有页面导航（`beforeunload`）
4. 失败策略：重试 2 次 → 跳过 → 暂停并询问

### 4.7 日志面板

- 每步记录：开始时间、耗时、状态（success/failed/skipped）、错误信息
- 实时追加到 UI 列表（虚拟滚动）
- 同时 `console.log` 结构化输出，便于 DevTools 查看
- 回放结束后生成摘要（通过率、总耗时、失败步骤）

### 4.8 排序与编辑

- 步骤列表支持拖拽排序（HTML5 Drag & Drop 或点击上下按钮）
- 批量操作：删除、复制、插入 wait / assertion 步骤
- 断言步骤：`assertText(selector, expected)`、`assertVisible(selector)`

### 4.9 存储与导出

- 存 IndexedDB（表 `test_cases`、`steps`），少量可用 `chrome.storage.local`
- 导出 JSON：完整用例
- 导出代码：Puppeteer / Playwright 风格脚本（可选）
- 导入 JSON 以便复用

## 5. 与扩展结合的注入方式

- 录制按钮在 popup 点击 → `chrome.scripting.executeScript` 注入 recorder content script
- 需要 `host_permissions` 或 `activeTab`
- 使用 `chrome.tabs.onUpdated` 处理导航中断
- 回放跨页面时用 `chrome.tabs.onUpdated` + `chrome.scripting` 重新注入

## 6. 安全与隐私

- 不回传真实密码：`input[type=password]` 只记录 `{masked:true}`
- 敏感字段（信用卡、token）默认跳过
- 用户可对步骤手动编辑/脱敏后再保存
- 录制前提示“将记录你的操作”

## 7. 验收标准

1. 在普通网页点击按钮、输入文本、滚动，回放后结果一致
2. React 输入框回放值正确（nativeInputValueSetter）
3. 动态加载元素回放成功（等待选择器）
4. 步骤可排序、删除、重命名
5. 失败步骤有日志与重试
6. iframe / Shadow DOM 页面可录制回放
7. 密码不被明文存储

## 8. 蒸馏提示

- 该扩展的 content script 注入模式、消息协议、IndexedDB 封装可以直接复用
- 事件选择器生成是回放可靠性的核心，建议优先实现 CSS path + data 属性
- Chrome 自身 Recorder 的步骤模型（navigate/click/type/scroll/wait）是行业事实标准，按它建模最稳妥
