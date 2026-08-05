---
name: popup-ui
description: 构建 Chrome 扩展弹窗界面：双 Tab（截图/录制）、录制设置、设备权限、倒计时、自动停止、录制中实时控制、用户登录态展示。当用户要求复刻 AwesomeScreenshot 的弹窗 UI 或构建截图/录制插件的操作面板时使用。
---

# Popup UI Skill

## 触发条件
- 用户要构建扩展 popup 面板
- 需要截图入口 + 录制设置
- 需要录制中控制（暂停/停止/定时）

## 核心知识

### 视图结构
```
main-menu          // 默认
capturing-view     // 滚动截图进行中
video-prepare-view // 云端连接中
video-countdown-view // 倒计时
recording-view     // 录制中
```
用 `switchView(id)` 切换，非 main 视图先关闭音量可视化。

### 双 Tab 状态
- `activeTab`: "screenshot" | "record"
- `popupTab`: "remember" | "record" | "screenshot"
- remember 模式下按上次选择打开
- Tab 切换时启停音量可视化与摄像头预览

### 录制设置项
- 麦克风：权限检查 + 设备下拉 + 音量可视化
- 摄像头：权限检查 + 设备下拉 + 预览
- Tab Sound：仅 tab/custom 模式显示
- 控制栏：ctl_bar 开关
- 分辨率：720/1080/4K（按会员等级限制）
- 保存位置：cloud/local（未登录强制 local）
- 倒计时：0-60s
- 自动停止：时/分/秒

### 录制启动流程
1. 校验登录/额度
2. Windows + desktop 首弹系统音频提示
3. 组装 `recordOptions`：
```js
{
  isRecordMic, recordType, countdown, saveLocation, resolution,
  isRecordCam, isShowToolbar, camDeviceId, micDeviceId,
  isRecordTabSound, isAutoStop, autoStopHour/Min/Sec
}
```
4. desktop：`chrome.windows.create({url:"/record.html", type:"popup", width:605, height:500})`
5. camera：`chrome.tabs.create({url:"/record.html", pinned:true})`
6. 监听 tabs.onUpdated，页面 complete 后发 `startRecord`

### 录制中控制
- 计时：100ms 轮询后台 `recordingTime`
- 暂停/继续：后台方法 + UI 状态
- 停止：`sendMessage({action:"stopStream"})` 后关窗
- 丢弃：确认弹窗后 `Bg.stopStream(true)`
- 摄像头/麦克风开关、标注开关、定时编辑

### 用户与会员
- cookie 读登录态与 premiumLevel
- `/api/v1/user/einfo` 同步额度
- 免费限制提示条（try/limit）

## 实现步骤
1. HTML 骨架 + CSS（或 React）
2. 双 Tab 切换与视图状态机
3. 设备枚举与权限状态
4. 设置项持久化（chrome.storage.local.options）
5. 录制启动流程
6. 录制中控制 UI
7. 登录态与额度展示
8. 验证关闭弹窗后录制继续

## 验证清单
- [ ] 双 Tab 记忆上次选择
- [ ] 无权限时正确引导
- [ ] 未登录不能选云端保存
- [ ] 关闭弹窗录制继续
- [ ] 倒计时/自动停止显示正确
- [ ] 录制中暂停/恢复/停止/丢弃可用
