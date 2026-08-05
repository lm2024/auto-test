# 01 PRD：弹窗界面模块

## 1. 模块职责

工具栏点击后弹出的主界面，负责：
- 截图入口（Visible / Selected / Full Page / Desktop / Annotate）
- 录制入口（Desktop / This Tab / Custom / Camera 四种模式）
- 录制选项（麦克风、摄像头、标签页声音、控制栏、倒计时、自动停止、分辨率、保存位置）
- 用户登录态与会员状态展示
- 录制中/准备中的实时视图（计时、暂停、停止、丢弃、摄像头/麦克风开关、标注开关、自动停止编辑）

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `popup2.html` | 空壳：`#app` + `232.bundle.js` + `popup2.bundle.js` |
| `javascripts/bundles/popup2.bundle.js` | React 弹窗逻辑 |
| `javascripts/bundles/232.bundle.js` | 运行时依赖 chunk |
| `javascripts/popup.js` / `popup.html` | 旧版 jQuery 弹窗（可参考其完整交互逻辑） |
| `javascripts/background.js` | 默认选项与安装逻辑 |

## 3. 视图状态机

```
main-menu ──点击截图/录制──> capturing-view / preparing / countdown
     ^                            │
     └──── 完成 / 取消 ────────────┘
recording-view <── 开始录制
```

- `main-menu`：默认视图，包含两个 Tab（screenshot / record）
- `capturing-view`：整页滚动截图进行中，显示进度百分比与“Stop”按钮
- `video-prepare-view`：云端连接中（“Connecting to the server...”）
- `video-countdown-view`：倒计时数字
- `recording-view`：录制中（计时、暂停/继续、停止、丢弃、相机/麦克风/标注/定时开关）

## 4. 功能需求

### 4.1 截图 Tab
- 按钮：Visible Part、Selected Area、Full Page、Entire Screen & App Window、Annotate Local & Clipboard Image
- 每项可显示快捷键提示（Ctrl+Shift+数字/字母）
- 延迟截图：`delay` 按钮显示 `localStorage.delay_sec` 秒数
- 桌面截图：显示 `desktop_delay_sec`
- 点击后走 `chrome.runtime.sendMessage({action: id, actionFrom:"pop"})`

### 4.2 录制 Tab
- 四种类型：`desktop` / `tab` / `custom` / `camera`
- 选项组：
  - Microphone（开关 + 设备下拉）
  - Embed Camera（开关 + 设备下拉）
  - Tab Sound（仅 tab/custom 显示）
  - Control Bar / Annotation tools
  - Max Resolution：720 / 1080 / 4K（会员限制）
  - Save video to：Cloud / Local
  - Countdown：0-60 秒
  - Auto-stop：时/分/秒定时
- 开始录制按钮逻辑：
  1. 校验保存位置与登录态
  2. Windows + desktop 首次提醒系统音频
  3. 无麦克风但选择了麦克风时弹出提醒
  4. 需要 setup 时打开 `/setup-react.html`
  5. desktop 模式打开 popup 窗口 `/record.html`
  6. camera 模式打开标签页 `/record.html`

### 4.3 录制中视图
- 计时显示（`Bg.recordingTime`，每 100ms 刷新）
- 暂停/继续：`Bg.pauseScreenRecording()` / `Bg.resumeScreenRecording()`
- 停止：`sendMessage({action:"stopStream"})` 或 `Bg.stopStream()`
- 丢弃：`Bg.stopStream(true)`，确认弹窗
- 摄像头/麦克风开关：`sendMessage({action:"init-camera"})`、`Bg.toggleMic()`
- 标注工具栏：`Bg.toggleToolbar()`
- 定时编辑：读 `Bg.timerHour/Min/Sec`，`Bg.updateAutoTimer(h,m,s)` / `Bg.updateAutoStop(false)`

### 4.4 用户与会员
- 读取 cookie：`screenshot_personal_fullname`、`screenshot_personal_type`、`screenshot_personal_premium_level`、`screenshot_personal_uid`
- `premiumLevel` 语义：`0` 免费，`>1` 高级，`type=1` 会员
- 免费限制：图片 100 张、视频 20 个、5 分钟限制
- 未登录时强制本地保存

## 5. 状态存储

弹窗配置全部存在 `chrome.storage.local.options`，字段包括：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `msObj` | 平台相关快捷键 | `{visible:{enable,key}, selected:..., entire:...}` |
| `format` | png | 图片格式 |
| `delay_sec` | 3 | 可见区域延迟 |
| `desktop_delay_sec` | 0 | 桌面延迟 |
| `popupTab` | remember | 弹窗默认 Tab |
| `activeTab` | record | 当前 Tab |
| `record_type` | desktop | 录制类型 |
| `record_mic` | true | 是否录制麦克风 |
| `record_countdown` | 3 | 倒计时秒数 |
| `max_resolution` | 720 | 最大分辨率 |
| `save-location` | cloud | 视频保存位置 |
| `save-capture-location` | cloud | 图片保存位置 |
| `record_tabsound` | true | 标签页声音 |
| `ctl_bar` | true | 显示控制栏 |
| `allow-remind-mic` | true | 麦克风关闭提醒 |
| `dark-mode` | false | 暗色模式 |

## 6. 消息协议

| 消息 | 方向 | 说明 |
| --- | --- | --- |
| `{action:"visible"/"selected"/"entire"/"delay"/"desktop"/"annotate"}` | popup → bg | 发起截图 |
| `{action:"stop-entire-capture"}` | popup → bg | 停止滚动截图 |
| `{action:"startRecord", recordOptions}` | popup → bg | 开始录制 |
| `{action:"stopStream"}` | popup → bg | 停止录制 |
| `{action:"updateRecordUI"}` | bg → popup | 更新录制 UI 状态 |
| `{action:"entireCaptureProgress"}` | bg → popup | 滚动截图进度 |
| `{action:"page-video-status"}` | bg → popup | 页面是否已有视频 |
| `{action:"previewCamView"}` | popup → bg | 摄像头预览 |
| `{action:"change-camera"}` | popup → bg | 切换摄像头 |

## 7. 关键实现细节

### 7.1 旧版 popup.js 的全局状态
旧版用 `chrome.extension.getBackgroundPage()` 直接读 `Bg.recordingStatus`、`Bg.recordingTime`、`Bg.cameraStream` 等全局变量。新架构改为：
- `recordingStatus` 写 `chrome.storage.local`
- `recordingInfo` 存录制窗口 ID
- 通过 `chrome.extension.getViews({windowId: recordWinId})[0]` 拿到录制窗口对象再访问 `Bg.xxx`

### 7.2 音量可视化
- `AudioContext.createScriptProcessor(512)` 做音量采样
- `volume = sqrt(sum(x^2)/n)`，平滑：`volume = max(current, volume*0.95)`
- 5x18px canvas 每帧重绘
- 超过 `clipLevel=0.98` 显示红色

### 7.3 设备枚举
- `navigator.mediaDevices.enumerateDevices()` + `navigator.permissions.query({name:"microphone"/"camera"})`
- 过滤空 label 的设备
- 无权限时引导 `/getAccess.html`

## 8. 蒸馏要点

1. 用 `chrome.storage.local` 存 options，避免依赖 localStorage 的兼容性问题
2. 弹窗状态机：main → preparing → recording，准备阶段每 100ms 轮询录制状态
3. 录制窗口单独创建，保证关闭弹窗后录制继续
4. 免费/会员限制逻辑集中在 `updateSavePlace` / `restoreSettings`，改造时可整体删除
5. 所有文案用 `chrome.i18n.getMessage`，个人插件可保留 i18n 结构
