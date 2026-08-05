---
name: screen-recorder
description: 在 Chrome MV3 扩展中实现桌面、标签页、区域、摄像头四种录制模式，包含音频混音、倒计时、自动停止、暂停恢复、分片输出、本地保存。当用户要求复刻 AwesomeScreenshot 的录屏能力、实现浏览器插件录屏或摄像头录制时使用。
---

# Screen Recorder Skill

## 触发条件
- 用户要构建浏览器扩展录屏功能
- 需要桌面 / 标签页 / 区域 / 摄像头录制
- 需要麦克风与系统声音混音、倒计时、暂停恢复

## 核心知识

### 四种取流方式
| 模式 | API | 备注 |
| --- | --- | --- |
| Desktop | `chrome.desktopCapture.chooseDesktopMedia(["screen","audio","window"])` + getUserMedia | 独立 popup 窗口承载后台 |
| Tab | `chrome.tabCapture.capture({audio, video, videoConstraints})` | 后台页播放 `tabSoundAudioPlayer` 消费音轨 |
| Custom | tabCapture + `ImageCapture.grabFrame()` + canvas 重绘 | 34ms 一帧，`canvas.captureStream()` |
| Camera | `getUserMedia({video, audio})` | 支持 PiP |

### 录制器选择
- Chrome 49+ / Edge / Firefox / Safari：`MediaRecorder`（MediaStreamRecorder）
- 老 Chrome / Opera：WhammyRecorder（canvas + WebP 帧）
- 推荐直接用 RecordRTC 库（本项目用 5.5.9），或自己封装 MediaRecorder

### 分片策略
- `MediaRecorder.start(timeSlice)` 分片输出
- 本地：3 秒一片，`fileSaver.save` 首片 + `append` 后续片
- 云端：500ms 一片，WebSocket 实时上行
- 每个分片都要走回调，不能累积在内存

### 音频混音
- `AudioContext.createMediaStreamSource(track)` → `createGainNode`（gain=0）→ `createMediaStreamDestination`
- 无麦克风时创建空 audio destination 保证有音轨
- 麦克风掉线：监听 `track.onended` → 重连 `default` 设备

### 录制生命周期
1. 用户配置选项 → 打开录制后台窗口
2. 取流 → 混音 → 创建 RecordRTC
3. 倒计时（badge 显示秒数）→ 开始录制
4. 每 100ms 更新时间，检查自动停止
5. 停止：recorder.stopRecording → 本地保存/云端 complete → 清理全局状态

### 录制窗口方案
- desktop：`chrome.windows.create({type:"popup", url:"/record.html"})`
- tab/custom：`chrome.tabs.create({url:"/record.html", pinned:true})`
- camera：popup 窗口 + `/camera.html`
- 关闭弹窗不影响录制，因为录制页是独立窗口/标签页

## 实现步骤
1. 写 `record.js` 控制器（状态、取流、混音、计时）
2. 写 `record-bg.js` 接收 startRecord 消息并调度
3. 实现四种取流函数与错误分类
4. 实现倒计时与自动停止
5. 实现本地分片写盘与元数据记录
6. 实现暂停/恢复/丢弃
7. 接入快捷键与上下文菜单
8. 验证四种模式

## 验证清单
- [ ] 四种模式都能录出可播放 webm
- [ ] 麦克风 + 系统声音混音无回授
- [ ] 暂停后时间不计入时长
- [ ] 自动停止准时
- [ ] 关闭弹窗后录制继续
- [ ] 桌面模式下所有页面消息广播正常
- [ ] 标签页关闭时自动停止并清理
