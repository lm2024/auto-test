# 06 PRD：云端 WebSocket 模块

## 1. 模块职责

把录制中的视频分片实时上传到服务端，实现“录完即分享”：
- 建立 WebSocket 连接并握手（init / recover）
- 边录边发分片（500ms 切片）
- 断线自动重连 + 未确认分片补发
- 完成后通知服务端 complete
- 暂停、取消、错误处理
- HTTP 兜底接口

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `javascripts/socketClient.js` | SocketClient 类 |
| `javascripts/record.js` | 调用方（handleBlob 里 send） |

## 3. 连接配置

```js
config = {
  ws: "wss",
  domain: "www.awesomescreenshot.com",
  cookie: "awesomescreenshot.com",
  schema: "https"
}
URL = wss://www.awesomescreenshot.com/websocket/video/open?time=<ts>
```

- `binaryType = "blob"`
- 可选域名：`preview.awesomescreenshot.com`、`www.awesomescreenshot.cn`

## 4. 协议

### 4.1 客户端 → 服务端

| type | 字段 | 说明 |
| --- | --- | --- |
| `init` | `title, token, userID, extra` | 新建录制。extra 含 userAgent、client、extVersion、recordType、sourceURL、screenSize、countdown |
| `recover` | `videoName, token, userID` | 断线恢复 |
| `slice` | `id, data` | 视频分片（二进制 blob） |
| `pause` | `videoName, reason, isErrorPause` | 暂停（含错误原因） |
| `complete` | `videoName, stopAt` | 完成 |
| `cancel` | `videoName` | 取消 |
| `resend`（内部） | 重发逻辑见下 | 重连后按服务端返回 id 补发 |

### 4.2 服务端 → 客户端

| type | 说明 |
| --- | --- |
| `init` | `{status:"1", videoURI, videoName, videoID}` 成功；否则错误 |
| `recover` | `{status:"1", id}` 恢复成功，客户端 `resendSent(id)` |
| `slice` | `{type:"slice", id}` 确认某分片已接收 |
| `complete` | 服务端通知可关闭 |

## 5. SocketClient 核心状态

| 状态 | 说明 |
| --- | --- |
| `connected` | WebSocket 已连接 |
| `unconnected` | 未连接 |
| `reconnecting` | 重连中 |
| `sentQueue` | 已发送未确认的分片（带递增 `currentSendId`） |
| `willSendQueue` | 待发送（离线或未连接时积压） |
| `retryCount` | 重连次数，上限 5 |

## 6. 发送逻辑

```js
send(data) {
  if (connected) {
    if (!onLine) willSendQueue.push(data)
    else if (lock) willSendQueue.push(data)
    else {
      sentQueue.push({id: currentSendId++, data})
      socket.send(data)
    }
  } else {
    willSendQueue.push(data)
  }
}
```

- 服务端 `slice` 确认后从 `sentQueue` 删除对应 id
- `willSendQueue.length > 150` 触发错误暂停（防内存爆炸）
- `resendSent(id)`：重连后把 `sentQueue` 中 id > 服务端 id 的补发

## 7. 重连策略

```
onclose → 未暂停且 needReconnect → reConnect()
reConnect:
  retryCount < 5：
    retryCount == 0 → connect()
    否则 2500ms 后 connect()
  retryCount >= 5：
    recording 状态 → handleError("recover failed")（暂停并置 badge "!"）
    否则 HTTP GET /api/v1/common/check_status 兜底
```

## 8. HTTP 兜底接口

| 接口 | 方法 | 用途 |
| --- | --- | --- |
| `/api/v1/video/complete` | POST `{videoName}` | WebSocket 断开时的完成上报 |
| `/api/v1/video/click_stop` | POST `{videoID}` | 用户主动停止 |
| `/api/v1/video/annotated_flag` | POST `{videoID}` | 标注完成标记 |
| `/api/v1/common/check_status` | GET | 服务端状态检查 |

## 9. 录制侧集成

- `initVideo(options)`：创建 `SocketClient`，`onopen` 后 `doBeginRecord`
- `handleBlob`：本地模式写文件；云端模式 `socketClient.send(blob)`
- `pauseScreenRecording`：云端先 `socketClient.pause("user click")`
- `complete`：连接可用时直接发 complete；不可用时 HTTP 兜底
- 错误处理：`handleError(msg)` → 暂停录制 + badge "!" + 弹窗提示

## 10. 权限与限制

- 认证靠 cookie：`screenshot_personal_session_id` + `screenshot_personal_uid`
- 云端免费 5 分钟限制，录制中 `checkTimeLength` 自动停止
- 2 小时弹窗提醒
- 超限时服务端返回 `"Professional Plan Required!"`，客户端自动降级本地保存

## 11. 蒸馏要点

1. 这是典型的“WebSocket 可靠传输”模板：发送队列 + 确认 + 断线重传
2. 视频分片不用等确认，靠服务端 id 回执做去重
3. `willSendQueue` 上限 150 是防止内存问题的关键
4. 服务端域名、cookie 名、接口路径全部要替换成自己的后端
5. 若不想自己搭后端，可整体删除云端模式，只保留本地录制
6. 推荐协议演进：分片带 `seq` + 服务端 `ack(seq)`，客户端重连后从最后 ack 继续
