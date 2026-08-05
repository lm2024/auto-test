---
name: permissions-browser-compat
description: 为 Chrome MV3 扩展设计最小权限清单、页面注入限制、file 权限、多浏览器兼容、快捷键、上下文菜单与首次安装引导。当用户要求复刻 AwesomeScreenshot 的权限体系、解决浏览器兼容或构建扩展设置页时使用。
---

# Permissions & Browser Compatibility Skill

## 触发条件
- 用户要设计扩展权限清单
- 需要处理 chrome:// 等不可注入页面
- 需要 Chrome/Edge/Firefox 兼容
- 需要设置页、快捷键、上下文菜单

## 核心知识

### 权限最小化
```json
{
  "permissions": ["storage", "unlimitedStorage", "desktopCapture", "activeTab", "scripting"],
  "optional_permissions": ["downloads", "notifications"],
  "host_permissions": ["<all_urls>"]
}
```
- `desktopCapture` 是桌面录制硬性需求
- `downloads` / `notifications` 用 `chrome.permissions.request` 按需申请
- content script 全部页面注入用 `<all_urls>`；个人插件可缩到具体站点

### 页面限制
```
chrome://*  edge://*  chrome-extension://*
chrome.google.com/webstore
ntp.msn.cn/edge/ntp
about:blank
```
- 不可注入时：按钮置灰、禁用自定义录制
- 页面未加载完成：禁用选区
- file://：`chrome.extension.isAllowedFileSchemeAccess()` 检查
- https 页面：部分插件出于安全禁用选区截图

### 多浏览器
- UA 检测 Chrome / Edge(Edg) / Firefox / Opera / Safari
- MediaRecorder 支持：Chrome 49+、Firefox、Safari、Edge
- 老浏览器回退：Whammy（canvas + WebP）
- 统计/客户端名区分 Edge 与 Chrome

### 快捷键
- `manifest.commands` 静态声明：
```json
"commands": {
  "start-or-stop-recording": {"suggested_key": {"default": "Ctrl+Shift+R"}},
  "pause-or-resume-recording": {"suggested_key": {"default": "Ctrl+Shift+P"}}
}
```
- `chrome.commands.onCommand` 监听

### 上下文菜单
- 录制前：Record Screen / Record Tab
- 录制中：Stop Recording
- 用 `chrome.contextMenus.update(menuId, {visible})` 切换

### 安装/卸载
- `chrome.runtime.onInstalled` 写默认配置
- `chrome.runtime.setUninstallURL` 卸载调查
- 版本迁移用版本号比较

## 实现步骤
1. 定 manifest 权限
2. 实现页面限制判断函数
3. 实现按需申请权限
4. 实现 UA 检测与录制器回退
5. 实现快捷键与上下文菜单
6. 实现设置页与默认值
7. 实现安装引导
8. 验证 Chrome 与 Edge

## 验证清单
- [ ] chrome:// 页面不报错、按钮禁用
- [ ] file:// 权限开关生效
- [ ] 未授予 downloads 时下载仍可用默认方式
- [ ] 快捷键可录制/暂停/恢复
- [ ] Edge 下扩展正常且统计名正确
- [ ] 卸载 URL 已设置
