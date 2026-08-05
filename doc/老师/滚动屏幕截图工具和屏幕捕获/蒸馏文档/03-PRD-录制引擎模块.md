# 03 PRD：录制引擎模块

## 1. 模块职责

实现四种屏幕/摄像头录制模式，支持：
- 麦克风、系统声音、标签页声音的采集与混音
- 摄像头嵌入 / 画中画（PiP）
- 倒计时、自动停止、暂停/继续、丢弃
- 分片输出（本地 3s、云端 500ms）
- 云端 WebSocket 实时上行或本地 IndexedDB 保存
- 录制中标注工具栏、鼠标高亮、点击高亮

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `javascripts/record.js` | 录制主控制器 |
| `javascripts/record-bg.js` | 接收 `startRecord` 并调度 |
| `javascripts/RecordRTC.js` | MediaStreamRecorder 等录制器 |
| `javascripts/socketClient.js` | 云端分片客户端 |
| `javascripts/CropStream2.js` | 自定义区域裁剪 |
| `javascripts/StreamCrop.js` | 早期裁剪版本 |
| `javascripts/camera.js` / `camera.html` | 摄像头预览 / PiP |
| `javascripts/bg.js` | 工具栏、上下文菜单、全局状态 |

## 3. 四种录制模式

### 3.1 Desktop
```js
chrome.desktopCapture.chooseDesktopMedia(["screen","audio","window"], cb)
getUserMedia({audio:{mandatory:{chromeMediaSource:"desktop", chromeMediaSourceId}},
              video:{mandatory:{chromeMediaSource:"desktop", chromeMediaSourceId, maxWidth:3840, maxHeight:2160, maxFrameRate:30}}})
```
- 录制窗口：`chrome.windows.create({url:"/record.html", type:"popup", width:605, height:500})`
- 桌面模式下所有页面都会收到消息（`broadCast`）

### 3.2 Tab（This Tab）
```js
chrome.tabCapture.capture({audio, video:true,
  videoConstraints:{mandatory:{chromeMediaSource:"tab", maxWidth, maxHeight}}}, cb)
```
- 只录制当前标签页
- 录制后台窗口：普通标签页 `/record.html`
- Tab 声音通过 `tabSoundAudioPlayer` 在后台播放，避免无声

### 3.3 Custom（区域录制）
- 先 `insertContentScript` + `prepareCustom` 让用户框选区域
- 同样用 `chrome.tabCapture.capture`
- 用 `CropStream2` 裁剪：
  1. `new ImageCapture(videoTrack)`
  2. `imageCapture.grabFrame()` 获取真实帧尺寸
  3. 把相对坐标换算成绝对像素（`absCrop`）
  4. canvas `drawImage` 每 34ms 重绘
  5. `canvas.captureStream()` + 原音频轨合成新 MediaStream

### 3.4 Camera
```js
getUserMedia({video, audio}) // 直接摄像头
```
- 打开 popup 窗口 `/camera.html?type=camera`，显示预览
- 支持 `requestPictureInPicture()`
- `camera.js` 通过 `window.postMessage` / `getBgCameraSteam()` 拿流

## 4. 音频混音

### 4.1 单流混音
`getMixedAudioStream([audioStream, videoStream])`：
- `AudioContext` + `createGainNode`（gain=0 静音，避免回授）
- 每个音轨 `createMediaStreamSource` → connect gain
- 最后 `createMediaStreamDestination()` 输出混合流
- 与视频轨合成新 MediaStream

### 4.2 无麦克风场景
- 创建空 AudioContext，`createMediaElementSource(audio)` 避免标签页音频重复
- 保证 MediaStream 至少有一个音频轨

### 4.3 麦克风热插拔
- `audioStreamStatusMonitor`：监听音轨 ended
- 麦克风掉线时尝试切回 `default` 设备重连
- `navigator.mediaDevices.ondevicechange` 检测设备恢复后自动重连

## 5. RecordRTC 配置

```js
recorder = new RecordRTC(mixedStream, {
  type: "video",
  disableLogs: false,
  getNativeBlob: true,
  timeSlice: isLocal ? 3000 : 500,   // 分片间隔
  ondataavailable: handleBlob
});
recorder.startRecording();
```

- 编码：`video/webm; codecs=vp8`
- `handleBlob(blob)`：
  - 本地：`fileSaver.save` 首片 + `fileSaver.append` 后续片 + `DB.save/update` 元数据
  - 云端：`socketClient.send(blob)`

## 6. 录制生命周期

### 6.1 开始
1. `beginRecord(options)`：记录类型、保存位置、分辨率、设备 ID
2. `getAllDevices()` + `sendDevicesToAll()`
3. `getStream()`：麦克风流 + 视频流
4. `saveStorage("recordingStatus","preparing")`
5. 云端：`initVideo({onopen})` → 收到 init 后 `doBeginRecord`
6. 本地：直接 `doBeginRecord`
7. `doBeginRecord`：先倒计时（badge 数字），再 `gotStream`
8. `gotStream`：混音 → 创建 RecordRTC → `startRecording` → `saveStorage("recordingStatus","recording")`

### 6.2 倒计时
- `countdown` 秒，badge 显示剩余秒数
- 每 1s `_cd--`
- 向录制标签页发送 `startCountDown`，页面显示倒计时浮层

### 6.3 暂停/继续
- `pauseScreenRecording()`：云端先发 pause、recorder.pauseRecording()、通知页面 pause
- `resumeScreenRecording()`：云端重连检查 → recorder.resumeRecording()
- 记录 `pausedTime`，恢复后从 `recordingStartTime + pausedTime` 计算时长

### 6.4 自动停止
- `timerHour/Min/Sec` + `isAutoTimerStop`
- `updateRecordingTime()` 每 100ms 检查 `recordTimeLength - startAutoStop >= timer*1000`
- 到时自动 `stopStream(false, true)`
- 录制中可编辑定时（`updateAutoTimer` / `updateAutoStop`）

### 6.5 停止
- `stopStream(discard)` → 触发 `videoStream.onended` → `stopScreenRecording`
- `recorder.stopRecording(cb)` 回调里：
  - 本地：`DB.delete(currentId)`（丢弃）或打开 `video-react.html?id=`
  - 云端：`socketClient.complete()` → 打开 `videoURI`（丢弃则 cancel）
- `setDefaults()` 清理所有全局状态

### 6.6 时长限制
- 免费用户云端 5 分钟（301000ms）自动停止
- 2 小时阈值弹窗提醒
- 本地免费 5 分钟限制

## 7. 快捷键

```js
chrome.commands.onCommand.addListener(cmd => {
  if (cmd === "pause-or-resume-recording") ...
  if (cmd === "start-or-stop-recording") ...
})
```

- `start-or-stop-recording`：未录制时对当前 Tab 发起 `prepareContextRecord("desktop")`
- 录制中触发 `stopStream()`

## 8. 录制中的 UI 消息

| 消息 | 说明 |
| --- | --- |
| `insertRecordDiv` | 注入录制浮层 |
| `prepareCustom` | 准备区域框选 |
| `startCountDown` | 显示倒计时 |
| `updateRecordTime` | 同步录制时间 |
| `pause` / `resume` | 控制栏暂停/继续 |
| `updateRecordUI` | 麦克风/摄像头状态 |
| `removeRecordDiv` / `endSelect` | 清理浮层 |
| `remove-toolbar` | 移除标注工具栏 |

## 9. 蒸馏要点

1. 桌面录制需要独立 popup 窗口；Tab 录制用普通标签页，注意标签页关闭时自动停止
2. 混音时 `gainNode.gain.value = 0` 是防止回授的关键
3. 分片间隔直接决定云端实时性（500ms）与本地磁盘碎片（3s）
4. `CropStream2` 用 ImageCapture.grabFrame + canvas 重绘实现区域裁剪，比录全屏再裁更省内存
5. 所有全局状态用 `window.xxx` 挂载，方便 `chrome.extension.getViews` 跨窗口访问，但这是 MV2 遗留，个人重构建议改成单例模块
6. `getVideoStream` 的错误分类（NotAllowedError / NotReadableError / Could not start audio source）直接决定错误页文案，值得保留
