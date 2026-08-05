---
name: event-recorder
description: 在 Chrome 扩展中实现 DOM 用户操作录制器，生成“Untitled Test Case”风格的步骤列表，支持事件识别、步骤排序、日志与回放。当用户要求复刻浏览器 Recorder 面板、录制用户操作、自动生成测试用例、回放点击/输入/滚动时使用。
---

# Event Recorder Skill

## 触发条件
- 用户要录制网页操作并回放
- 需要类似 Chrome DevTools Recorder 的 “Test Case” 功能
- 需要识别事件类型、调整步骤顺序、显示日志

## 核心知识

### 事件捕获
在 content script 用捕获阶段监听（`addEventListener(type, fn, true)`），避免被页面拦截：
- `click` / `dblclick`
- `input` / `change`（记录前后值）
- `keydown` / `keyup`（key, code, modifiers）
- `scroll` / `wheel`（节流 100ms）
- `focus` / `blur`
- `submit`

注意：不要在页面脚本之前被 `stopImmediatePropagation` 拦截；使用 `document` 级监听 + 事件委托。

### 选择器生成（回放可靠性的核心）
优先级：
1. `#id`（须全页唯一）
2. `[data-testid]` / `[data-qa]` / `[name]` / `[aria-label]`
3. 语义元素：`button`、`a`、`input[type=submit]`
4. CSS 路径：`body > div:nth-child(2) > button`
5. 文本回退：`button:has-text("登录")`

同时记录 `tagName`、`text`（截断）、`href`、`value`、`xPath`。

### 数据模型
```json
{
  "id": "case_1720000000000",
  "name": "Untitled Test Case",
  "url": "https://example.com",
  "steps": [{
    "id": "step_1",
    "order": 1,
    "type": "click",
    "selector": "#login-btn",
    "framePath": [],
    "x": 100, "y": 30,
    "timestamp": 1720000000123
  }]
}
```

### 回放引擎
- 每步：定位元素（带等待，MutationObserver + 10s 超时）→ 派发事件 → 校验
- click：`new MouseEvent("click", {bubbles:true, clientX, clientY})` 或 `el.click()`
- input：React/Vue 必须用 `nativeInputValueSetter` + 派发 input/change
- key：`new KeyboardEvent("keydown", {key, code, keyCode})`
- scroll：`el.scrollTo(x,y)` / `window.scrollTo`
- 失败重试 2 次 → 跳过 → 暂停询问
- 跨页面：监听 `chrome.tabs.onUpdated` 后重新注入 content script

### iframe 与 Shadow DOM
- 记录 `framePath: [0,1]` 逐级 frame 索引
- Shadow DOM 记录 `shadowHostPath` + 内部选择器

### 安全
- `input[type=password]` 只记录 `{masked:true}`
- 敏感字段默认跳过
- 录制前提示

## 实现步骤
1. 创建 `recorder.js` content script（事件捕获 + 选择器生成）
2. 创建用例存储模块（IndexedDB 或 chrome.storage）
3. 创建管理面板（popup 或 options）：列表、排序、重命名、导出
4. 创建 `replay.js` content script（定位 + 派发 + 校验）
5. 创建日志面板（每步状态、耗时、错误）
6. 处理跨页面与动态元素
7. 验证 React / Vue / iframe / Shadow DOM

## 验证清单
- [ ] 点击、输入、滚动、键盘事件都能录制
- [ ] 回放后页面状态与录制时一致
- [ ] React 输入框回放值正确
- [ ] 动态加载的元素回放成功
- [ ] 步骤可排序、删除、重命名
- [ ] 密码不明文存储
- [ ] 失败步骤有日志与重试
