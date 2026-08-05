# AwesomeScreenshot 2.0.5 蒸馏文档体系

本目录是对 `2.0.5_0`（Chrome Manifest V3 扩展）的完整逆向蒸馏成果，目标是帮助你理解它的每一个模块，并据此筛选、裁剪、改造成自己的个人插件。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [00-总览-架构蒸馏.md](00-总览-架构蒸馏.md) | 整体架构、进程模型、消息通道、数据流、权限、浏览器兼容策略 |
| [01-PRD-弹窗界面模块.md](01-PRD-弹窗界面模块.md) | popup 双 Tab、录制设置、录音/摄像头 UI、倒计时、自动停止 |
| [02-PRD-截图捕获模块.md](02-PRD-截图捕获模块.md) | 可见区域、选区、整页滚动截图、桌面截屏、图片上传队列 |
| [03-PRD-录制引擎模块.md](03-PRD-录制引擎模块.md) | Desktop / Tab / 区域 / 摄像头四种录制、RecordRTC、混音、分片 |
| [04-PRD-事件捕获与用例录制.md](04-PRD-事件捕获与用例录制.md) | 扩展内真实事件机制 + “Untitled Test Case”功能的设计蓝图 |
| [05-PRD-本地存储与视频管理.md](05-PRD-本地存储与视频管理.md) | IndexedDB、FileSystem API、视频列表、缩略图、EBML 修复 |
| [06-PRD-云端WebSocket模块.md](06-PRD-云端WebSocket模块.md) | SocketClient、分片上行、重连、确认队列、HTTP 兜底 |
| [07-PRD-标注与控件栏模块.md](07-PRD-标注与控件栏模块.md) | Diigo 标注器、录制工具栏、注入/移除流程 |
| [08-PRD-权限浏览器兼容与设置.md](08-PRD-权限浏览器兼容与设置.md) | Manifest 权限策略、页面白名单/黑名单、file 权限、多浏览器兼容 |
| [09-隐晦知识点.md](09-隐晦知识点.md) | Cookie 认证、OAuth、跨扩展消息、内嵌播放、统计、限制逻辑等隐藏细节 |

## 输出产物

| 目录 | 内容 |
| --- | --- |
| [skills/](skills/) | 每个功能一份可被 Agent 直接使用的 Skill（SKILL.md 风格） |
| [prompts/](prompts/) | 每个功能一份可直接复制给 Agent 的提示词模板 |

## 蒸馏结论速览

1. 该项目是 **AwesomeScreenshot（滚动截图 + 屏幕录制）** 的 Chrome MV3 扩展，核心能力是“截图”和“录制”，不包含完整的产品化“Test Case 录制回放器”。
2. 你看到的“Untitled Test Case / 显示我的事件 / 调整顺序 / 日志”更接近 **Chrome DevTools 内置 Recorder 面板** 的行为，而不是本扩展的行为。本扩展只在内容脚本里监听 DOM 事件用于区域选择、滚动截图、快捷键和录制标注。
3. 如果你要做一个“事件用例录制器”，需要自行设计：DOM 事件监听、元素选择器生成、事件序列建模、回放引擎、日志面板和排序交互。`04-PRD-事件捕获与用例录制.md` 提供了完整设计。
4. 本项目大量硬编码了 AwesomeScreenshot 的服务端域名（`https://www.awesomescreenshot.com`、`wss://www.awesomescreenshot.com`、`preview.diigo.com`）、Google OAuth 凭据和 GA 统计 ID。改造为个人插件时建议全部替换或移除。
5. 建议保留的核心能力：滚动截图算法、选区截图、RecordRTC 录制、分片上传思路、IndexedDB 本地存储、标注工具栏、权限与浏览器兼容处理。

## 快速阅读顺序

先读 `00-总览-架构蒸馏.md`，再按你关心的模块读对应 PRD；需要让 Agent 复刻某个功能时，直接使用 `prompts/` 里的提示词，或把 `skills/` 里的 Skill 安装到 Agent 环境。
