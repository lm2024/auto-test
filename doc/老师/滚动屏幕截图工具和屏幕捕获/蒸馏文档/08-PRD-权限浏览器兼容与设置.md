# 08 PRD：权限、浏览器兼容与设置模块

## 1. 模块职责

- Manifest 权限的最小化与按需申请
- 判断哪些页面可以注入 content script
- file:// 权限检查
- Chrome / Edge / Firefox / Opera 兼容
- 设置页面（快捷键、格式、延迟、自动保存等）
- 上下文菜单
- 安装/卸载/版本迁移

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `manifest.json` | 权限、content_scripts、commands、oauth2 |
| `javascripts/background.js` | 默认选项、版本迁移 |
| `javascripts/detect.js` | 浏览器/OS 检测 |
| `javascripts/bg.js` | 上下文菜单、权限申请 |
| `javascripts/popup2.js` / `popup.js` | 页面限制判断 |
| `javascripts/option-react.html` / `option.bundle.js` | 设置页 |
| `javascripts/getAccess.js` / `getAccess.html` | 麦克风/摄像头授权引导 |
| `javascripts/permission.js` / `permission-denied.html` | 桌面录制失败引导 |
| `javascripts/notification.js` | 通知页 |

## 3. Manifest 权限分析

| 权限 | 用途 | 能否裁剪 |
| --- | --- | --- |
| `storage` | options / userinfo | 保留 |
| `unlimitedStorage` | 大视频文件存储 | 保留（录制需要） |
| `desktopCapture` | 桌面/窗口/系统音频 | 只有桌面录制需要 |
| `activeTab` | 当前标签截图 | 保留 |
| `scripting` | 动态注入录制脚本 | 保留 |
| `downloads`（optional） | 保存文件到指定目录 | 按需申请 |
| `notifications`（optional） | 通知 | 按需申请 |
| `host_permissions: <all_urls>` | content script 注入全部页面 | 个人插件可缩小到 `<all_urls>` 或指定站点 |
| `web_accessible_resources` | 页面内加载图标/工具栏 | 保留所需图片 |

## 4. 页面限制规则

`isNotAcceptedTab(url)`：
```js
url.match(/chrome(.*):\/\//)      // chrome:// 内部页
|| url.match(/edge(.*):\/\//)     // edge://
|| url.match(/chrome-extension:\/\//)  // 扩展页
|| url.match(/https:\/\/chrome.google.com\/webstore/i)
|| url.match(/https:\/\/ntp.msn.cn\/edge\/ntp/i)
|| url.match(/about:blank/)
```

弹窗里的动态判断：
- `http/https/file/ftp` 之外的 URL 禁用内容相关按钮
- Edge 下 webstore 也禁用
- 页面未 `complete` 时禁用“Selected Area”
- https 页面禁用选区截图（安全原因）
- `file://` 页面需 `chrome.extension.isAllowedFileSchemeAccess()`

## 5. 浏览器兼容实现

### 5.1 检测
```js
BrowserDetect.init();
// browser: Chrome / Edge(Edg) / Firefox / Opera / Safari
// OS: Windows / Mac / Linux
```

### 5.2 录制器选择（RecordRTC）
- Chrome 49+：`MediaStreamRecorder`（MediaRecorder API）
- 老 Chrome / Opera：`WhammyRecorder`（canvas 帧 + WebP → webm）
- Safari / Firefox：`MediaStreamRecorder`
- 多流：`MultiStreamsMixer`

### 5.3 统计区分
- `getClientStr()`：`Edg` → `"Edge extension"`，否则 `"Chrome extension"`

## 6. 设置页选项

默认值（`setDefaultOptions`）：
- 快捷键：Windows 默认 `Ctrl+Shift+1/S/E`，其它系统 `Ctrl+Shift+V/S/E`
- 图片格式：png
- 延迟：3s
- 数据跟踪：开
- 添加 URL：关
- 三方内嵌播放：Slack/Trello/Asana/GitHub/Jira 开，Gmail 关
- 自动保存路径：开
- 显示通知：开
- popup 默认 Tab：remember
- 保存时询问路径：开
- 麦克风提醒：开
- 录制麦克风：开
- 倒计时：3s
- 最大分辨率：720
- 云端保存：cloud
- 标签页声音：开
- 控制栏：开
- Gmail 按钮：开
- 上下文菜单：开

## 7. 上下文菜单

```
Record Screen（record_desktop）
Record Tab（record_tab）
Stop Recording（stop_record，录制中才显示）
```

- `initContextMenu()` / `updateContextMenu(isRecording)`
- 点击后 `prepareContextRecord(type, isSignIn)`
- 录制中把三个菜单项互斥切换

## 8. 快捷键（manifest commands）

- `start-or-stop-recording`：开始/停止录制
- `pause-or-resume-recording`：暂停/恢复

## 9. 安装与卸载

- `chrome.runtime.onInstalled`：写默认 options；安装时设置卸载调查 URL
- 卸载 URL：`https://www.awesomescreenshot.com/uninstall?...`
- 版本迁移：`isBeforeVersion("4.3.33", version)` 处理 popupTab 默认值变化
- 首次安装弹 setup 页（无麦克风/无权限时）

## 10. 错误引导页

### 10.1 getAccess.html
- 请求麦克风/摄像头权限
- 成功后显示成功提示，失败提示原因
- 供 popup 中“Grant Access”按钮跳转

### 10.2 permission-denied.html
- 桌面录制失败分类：
  - `mac` + 系统权限拒绝
  - `win` + 音频源冲突（Could not start audio source / NotReadableError）
  - `browser_issue`：重启浏览器引导（复制 `chrome://restart`）
- 参数：`?os=mac|win&type=mic|browser_issue|camera`

## 11. 蒸馏要点

1. 权限按需申请是 MV3 最佳实践：`desktopCapture` 常驻，`downloads`/`notifications` optional
2. 页面限制判断要覆盖 Chrome、Edge 各自的内部页
3. 首次安装的 setup 引导和卸载调查 URL 是完整产品细节，个人插件可删
4. 设置默认值集中在一个函数，便于维护
5. `unlimitedStorage` + FileSystem API 组合是本地录制的核心保障
6. 快捷键在 `manifest.commands` 声明，无法运行时动态新增
