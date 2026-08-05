---
name: cloud-websocket-upload
description: 实现浏览器扩展把录制视频分片通过 WebSocket 实时上传到服务端的可靠传输客户端，包含握手协议、确认队列、断线重连、未确认分片补发、HTTP 兜底。当用户要求复刻 AwesomeScreenshot 的云端录制上传、实现 WebSocket 分片上传或可靠实时上传通道时使用。
---

# Cloud WebSocket Upload Skill

## 触发条件
- 用户要边录边传视频分片
- 需要断线重连 + 未确认数据重传
- 需要“录完即分享”的链接

## 核心知识

### 客户端状态
```
connected | unconnected | reconnecting
sentQueue     // 已发送、等待服务端确认
willSendQueue // 待发送积压
retryCount    // 重连次数（上限 5）
currentSendId // 分片自增序号
```

### 握手协议
连接后发送：
```json
{"type":"init","title":"...","token":"<session>","userID":"<uid>",
 "extra":{"userAgent":"...","client":"Chrome extension","extVersion":"2.0.5",
          "recordType":"desktop","sourceURL":"...","screenSize":"1920*1080","countdown":3}}
```
服务端回复 `{type:"init", status:"1", videoURI, videoName, videoID}` 后开始录制。

断线恢复发送：
```json
{"type":"recover","videoName":"...","token":"...","userID":"..."}
```
服务端回 `{type:"recover", status:"1", id}`，客户端 `resendSent(id)` 补发。

### 可靠发送
- 每片带递增 id 存入 sentQueue 再 send
- 服务端回 `{type:"slice", id}` 后从 sentQueue 删除
- 离线或未连接时进 willSendQueue
- willSendQueue 上限（本项目 150 片）防止内存爆炸
- 重连成功后按最后确认 id 补发

### 重连
- onclose 触发，未暂停则重连
- 0 次立即连，之后 2500ms 间隔
- 5 次失败：录制中暂停并提示；否则 HTTP 检查服务端状态
- 暂停时不需要重连

### HTTP 兜底
- 完成：POST `/api/v1/video/complete` `{videoName}`
- 主动停止：POST `/api/v1/video/click_stop` `{videoID}`
- 标注完成：POST `/api/v1/video/annotated_flag` `{videoID}`
- 状态检查：GET `/api/v1/common/check_status`

### 分片节奏
- 云端 500ms 一片；本地 3s 一片
- 分片过大（>150 积压）触发错误暂停

## 实现步骤
1. 实现 SocketClient 类（状态机 + 队列）
2. 实现 init / recover / slice / pause / complete / cancel 协议
3. 接入录制器的 ondataavailable
4. 实现重连与补发
5. 实现 HTTP 兜底
6. 实现错误暂停与 badge 提示
7. 验证弱网/断网/恢复场景

## 验证清单
- [ ] 正常录制上传后服务端能拼出完整视频
- [ ] 断网 10 秒恢复后无数据丢失
- [ ] 重连 5 次失败会暂停而非崩溃
- [ ] 暂停期间不发数据
- [ ] complete 后连接可安全关闭
- [ ] 取消录制服务端不生成视频
