# TECH-12 · 测试报告、失败截图与结果输出（技术蒸馏）

> 适用对象：想把 Katalon Recorder 7.1.0（MV3）逆向裁剪为个人录制回放插件的工程师。
> 文档纪律：所有结论均来自只读源码目录 `KatalonRecorder/7.1.0_0`，引用格式为 `文件路径:行号`，并附真实片段。找不到的事实显式标注「未在源码中找到，推测：…」。

---

## 1. 一句话概括

Katalon Recorder 的「报告」本质上**不是一个报告引擎，而是一段被反复复用的 DOM**：回放过程中所有日志都以 `<h4 class="log-info|log-error">` 追加进 `#logcontainer`，失败时通过 Service Worker 调 `tabs.captureVisibleTab` 抓一张 PNG 的 dataURL、包成 `<a><img></a>` 也塞进同一个容器；点「Save」时把 `#logcontainer.innerHTML` 原样拼进一段内联 HTML 模板、`Blob → createObjectURL → downloads.download` 落盘；点「Upload」时把同一个容器的 `textContent` 上传到 Katalon TestOps 云端。**整条链路没有任何中间数据结构（没有 Report 对象、没有 JSON 结果模型），DOM 就是数据源。**

---

## 2. 关键文件清单

| 文件 | 行数 | 职责 | 裁剪建议 |
|---|---|---|---|
| `panel/js/UI/models/logger/logger.js` | 58 | `class Log`：面板层日志渲染器，`log/info/error/appendA/logHTML/logScreenshot` | **保留**，核心 |
| `panel/js/UI/index.js:36` | — | `window.sideex_log = new Log(document.getElementById("logcontainer"))` 全局单例 | 保留 |
| `playback/service/log-service.js` | 25 | `class Logger`：CLI/socket 回放通道的日志器，**只写 console** | 可删（除非要 CLI 回放） |
| `panel/js/katalon/kar-screenshot.js` | 29 | `addToScreenshot(imgSrc,title)` / `clearScreenshotContainer()` / `#download-all` | **保留**，核心 |
| `background/kar.js:159-194` | — | SW 侧 `captureEntirePageScreenshot` 消息处理 → `tabs.captureVisibleTab` | **保留**，核心 |
| `content/command-receiver.js:67-76` | — | 内容脚本把 `captureEntirePageScreenshot` 命令转发给 SW | 保留（显式截图命令用） |
| `panel/js/background/playback/service/actions/play/play-actions.js:1421-1451` | — | 回放失败时自动截图 + 成功时回收命令产生的截图 | **保留**，核心 |
| `panel/js/UI/services/html-service/save-log.js` | 37 | `saveLog()`：拼 HTML 模板 + 下载 | **保留**（有 bug，见 §7.1） |
| `panel/js/UI/services/helper-service/make-text-file.js` | 28 | `makeTextFile/makeTextFileJSON`：Blob → objectURL | 保留 |
| `panel/js/UI/controllers/other-listeners/log.js` | 10 | `#save-log` / `#clear-log` 按钮绑定 | 保留 |
| `panel/js/UI/view/records-grid/set-color.js` | 36 | 命令行/用例着色 + `#result-runs` / `#result-failures` 计数 | 保留 |
| `panel/js/UI/services/data-service/test-command-service.js` | 11 | `setTestCommandStatus` 把 `success/fail` 写回数据模型 | 保留 |
| `panel/js/katalon/kar.js:513-533` | — | `logTime/logStartTime/logEndTime`：环境信息与时间戳 | 保留 |
| `panel/js/katalon/kar.js:1-41` | — | `testOpsEndpoint` / `testOpsUrls` / `updateTestOpsLoginToken` | **删除**（云端） |
| `panel/js/katalon/kar-upload.js` | 287 | TestOps 备份 / 报告上传 / 项目选择弹窗 | **删除**（云端） |
| `panel/js/UI/services/test-ops-service/test-ops-service.js` | 10 | 每 15 分钟自动备份定时器 | **删除**（云端） |
| `panel/js/UI/controllers/other-listeners/test-ops.js` | 33 | TestOps 按钮监听 + 启动定时备份 | **删除**（云端） |
| `panel/index.html:687-692` | — | `#logcontainer` / `#screenshotcontainer` DOM 骨架 | 保留 |
| `panel/index.html:318-331` | — | `#result-runs` / `#result-failures` 通过/失败计数条 | 保留 |
| `panel/index.html:653-657` | — | `#save-log` / `#clear-log` / `#download-all` 工具条 | 保留 |
| `panel/css/kar.css:1429-1476, 1688-1694` | — | 日志与缩略图样式 | 保留（模板里也要复制一份） |
| `playback/service/play-actions-service.js:992-1000` | — | CLI 通道失败截图（**抓了但丢弃**） | 删 |
| `manifest.json:64` | — | `permissions` 含 `downloads`（下载报告必需） | 保留 |

---

## 3. 核心机制逐层拆解

### 3.1 双轨日志：`Logger`（console）vs `Log`（DOM）

源码里存在**两个互不相干的日志类**，分属两条回放通道：

**A 轨 · `playback/service/log-service.js`（1-25 行）** —— 给 socket.io/CLI 回放用，只吐 console：

```js
class Logger {
  constructor() {
  }

  info(message){
    console.info(message);
  }

  error(message){
    console.error(message);
  }

  log(message){
    console.log(message);
  }

  logTime(){
    let now = new Date();
    console.info("Time: " + now + " Timestamp: " + now.getTime());
  }

}


const logger = new Logger();
export {logger}
```

这条轨的「报告」实际是通过 socket.io 往 `localhost:3500` 发的：`playback/service/play-actions-service.js:93` `socketLog.emit("logger", {mess, type})`、`:986` `socketLog.emit("result", {testcase, result})`、`:111` `socketLog.emit("doneSuite", ...)`。socket 在 `playback/index.js:3` 建立：

```js
const socket = io.connect('http://localhost:3500');
```

> 裁剪：个人插件不需要 Katalon Studio 联动，**整个 `playback/` 目录 + `content-marketing/socket-io/socket-io.min.js` 可删**。

**B 轨 · `panel/js/UI/models/logger/logger.js`（1-59 行）** —— 面板 UI 用，写 DOM。全文：

```js
class Log {

  constructor(container) {
    this.container = container;
  }

  log(str) {
    this._write(str, "log-info");
  }

  info(str) {
    this._write("[info] " + str, "log-info");
  }

  error(str) {
    this._write("[error] " + str, "log-error");
  };

  appendA(str, id) {
    let a = document.createElement('a');
    a.setAttribute("href", "#");
    a.setAttribute("id", id);
    a.setAttribute("class", "katalon-link");
    a.textContent = str;
    this.container.appendChild(a);
    this.container.scrollIntoView(false);
  }

  _write(str, className) {
    let textElement = document.createElement('h4');
    textElement.setAttribute("class", className);
    textElement.textContent = str;
    this.container.appendChild(textElement);
    this.container.scrollIntoView(false);
  }

  //KAT-BEGIN log HTML
  logHTML(str) {
    this.container.innerHTML = str;
    this.container.scrollIntoView(false);
  }

  logScreenshot(imgSrc, title) {
    let className = "log-info";
    let textElement = document.createElement('h4');
    textElement.setAttribute("class", className);

    var a = $('<a></a>').attr('target', '_blank').attr('href', imgSrc).attr('title', title).attr('download', title);
    var img = $('<img>').attr('src', imgSrc).addClass('thumbnail');

    $(textElement).append(a.append(img));
    this.container.appendChild(textElement);
    this.container.scrollIntoView(false);
  }

  //KAT-END
}

export { Log }
```

实例化在 `panel/js/UI/index.js:35-38`：

```js
$(document).ready(function(){
    window.sideex_log = new Log(document.getElementById("logcontainer"));
    window.help_log = new Log(document.getElementById("refercontainer"));
});
```

注意 **`sideex_log` 是挂在 `window` 上的全局变量**（非 ES module 导出），所以 `play-actions.js`、`element-actions.js`、`recorder.js`、`formatCommand.js` 里都能直接 `sideex_log.info(...)` 而无需 import。

### 3.2 日志「分级」的真相：只有两级，且靠 CSS class 区分

| 方法 | 输出前缀 | CSS class | 颜色（`panel/css/kar.css:1688-1694`） |
|---|---|---|---|
| `Log.log(str)` | 无前缀 | `log-info` | `var(--main-txt-color)` |
| `Log.info(str)` | `[info] ` | `log-info` | 同上 |
| `Log.error(str)` | `[error] ` | `log-error` | `#EA4335`（红） |
| `Log.logScreenshot()` | 无（图片） | `log-info` | — |
| `Log.appendA(str,id)` | 无（`<a>`） | `katalon-link` | 主题链接色 |

**没有 warn / debug / trace 级别，也没有时间戳字段** —— 时间是靠 `logStartTime()`/`logEndTime()` 手动插一行文本实现的（`panel/js/katalon/kar.js:513-533`）：

```js
function logTime() {
  var now = new Date();
  sideex_log.info("Time: " + now + " Timestamp: " + now.getTime());
}

function logStartTime() {
  logTime();
  sideex_log.info(
    "OS: " + (bowser.osname || "") + " Version: " + (bowser.osversion || "")
  );
  sideex_log.info(
    "Browser: " + (bowser.name || "") + " Version: " + (bowser.version || "")
  );
  sideex_log.info(
    "If the test cannot start, please refresh the active browser tab"
  );
}

function logEndTime() {
  logTime();
}
```

也就是说，**报告里的「环境信息」只有 OS + 浏览器 + 两个时间戳**，全部来自 `bowser` 这个 UA 解析库（`panel/js/katalon/bowser.js`，`panel/index.html:117` 引入）。

### 3.3 一次回放的日志时间线（真实调用点）

| 时机 | 调用 | 位置 |
|---|---|---|
| 开始回放前清空 | `$("#logcontainer").empty()` | `play-actions.js:83` |
| 同时清空计数 | `$("#result-runs").html("0"); $("#result-failures").html("0")` | `play-actions.js:84-85` |
| 同时清空截图区 | `clearScreenshotContainer()` | `play-actions.js:89` |
| 打印用例名 | `sideex_log.info("Playing test case " + suite.name + " / " + case.name)` | `play-actions.js:169-171` |
| 打印环境+时间 | `logStartTime()` | `play-actions.js:172` |
| 变量展开 | `sideex_log.info("Expand variable '"+orig+"' into '"+expanded+"'")` | `play-actions.js:1523-1525` |
| store / echo | `sideex_log.info("Store '...' into '...'")` / `"echo: ..."` | `formatCommand.js:63,67` |
| 命中 frame | `sideex_log.info("Element is found in "+text+" frame.")` | `element-actions.js:97` |
| 找不到元素 | `sideex_log.error("Element is not found.")` | `element-actions.js:111` |
| 各类等待 | `"Wait for the new page to be fully loaded"` / `"Page Wait timed out after 30000ms"` … | `play-actions.js:864-1002` |
| 自愈候选 | `sideex_log.info(logMessage)` | `play-actions.js:1271` |
| 命令失败 | `sideex_log.error(result.result)` | `play-actions.js:1375` |
| 用例失败 | `logEndTime(); sideex_log.info("Test case failed")` | `play-actions.js:1403-1404` |
| 用例通过 | `logEndTime(); sideex_log.info("Test case passed")` | `play-actions.js:547-548` |
| 暂停/恢复/停止 | `"Pausing"` / `"Resuming"` / `"Stop executing"` | `play-actions.js:233,219,211` |
| 断点 | `sideex_log.info("Breakpoint: Stop.")` | `play-actions.js:592` |
| 回放结束追加上传链接 | `sideex_log.appendA("Upload this execution to Katalon TestOps","ka-upload-log")` | `play-actions.js:739-742` |

> 隐晦点：**`initBeforePlay()` 只在「整体开始」时清空一次**（`play-actions.js:80-122`），因此播放 Test Suite 时所有用例的日志会**连续追加在同一个容器里**，报告是「整个套件一份」，不是「每个用例一份」。

### 3.4 结果计数：`#result-runs` / `#result-failures` 的诡异算法

DOM 在 `panel/index.html:318-331`：

```html
<article id="result-container" class="module">
  <div class="fieldset">
    <div class="result-row">
      <img src="/katalon/images/SVG/pass-icon.svg" alt="" />
      <label id="result1">Passed</label>
      <div id="result-runs" class="runs">0</div>
    </div>
    <div class="result-row">
      <img src="/katalon/images/SVG/fail-icon-new.svg" alt="" />
      <label id="result2">Failed</label>
      <div id="result-failures" class="failures">0</div>
    </div>
  </div>
</article>
```

计数逻辑并不是「计数器 ++」，而是**每次着色时重新数 DOM**（`panel/js/UI/view/records-grid/set-color.js:1-23`）：

```js
function setColor(index, state) {
  if (typeof (index) == "string") {
    $("#" + index).addClass(state);

    // KAT-BEGIN increase failure result to 1 once
    if (state == "fail") {
      if($("#img-"+index)){
        $("#img-"+index).attr("src","icons/fail.svg");
      }
      document.getElementById("result-failures").textContent = $('.test-case-title.' + state).length;
    } else {
      if($("#img-"+index)){
        $("#img-"+index).attr("src","icons/success.svg");
      }
      document.getElementById("result-runs").textContent = $('.test-case-title.' + state).length - $('.test-case-title.success.fail').length;
    }
    // KAT-END
  } else {
    var node = document.getElementById("records-" + index);
    node.className = state;
    setRecordScrollTop(node);
  }
}
```

三个要点：

1. `setColor(index, state)` **一函数两用**：`index` 是字符串 → 是「用例 ID」，走计数分支；`index` 是数字 → 是「命令行号」，只染色 + 滚动。
2. Passed 数 = `.test-case-title.success` 的个数 **减去** 同时带 `success` 和 `fail` 的个数 —— 因为 `addClass` 只加不删，一个用例先成功后失败会同时挂两个 class，靠这个减法去重。
3. 命令级状态则写进数据模型（`panel/js/UI/services/data-service/test-command-service.js:3-9`）：

```js
const setTestCommandStatus = (testCaseID, commandIndex, state) => {
  const testCase = findTestCaseById(testCaseID);
  if (commandIndex >= testCase.commands.length){
    return;
  }
  testCase.commands[commandIndex].status = state;
}
```

**`command.status` 是唯一进入内存数据模型的「结果字段」**，但它**没有被写进任何报告**（saveLog 只读 DOM）。这是重建时最值得改的地方：把 `command.status` 汇总成结构化 JSON 报告。

---

## 4. 失败截图：API、时机、存储、嵌入

### 4.1 API 选型：`tabs.captureVisibleTab`（在 Service Worker 里）

MV3 下 `chrome.tabs.captureVisibleTab` **只能在扩展进程（SW / 扩展页）调用**，内容脚本无权限。所以设计成「谁需要截图 → 发消息给 SW → SW 抓图 → 回传 dataURL」。

SW 侧处理器（`background/kar.js:159-194`）：

```js
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.captureEntirePageScreenshot) {
        var windowId = request.captureWindowId || sender.tab.windowId;
        retryUntilSuccess(
            () => browser.tabs.captureVisibleTab(windowId, { format: 'png' })
        ).then((image) => {
            sendResponse({
                image: image
            });
        });
        return true;
    } else {
        // ... uploadFile / sendSpecialKeys 走 debugger 协议
    }
});
```

三个关键细节：

- **`windowId` 而非 `tabId`**：`captureVisibleTab(windowId, options)` 抓的是「该窗口当前可见标签页」。调用方必须传 `captureWindowId: extCommand.getContentWindowId()`，否则被测页不在前台就会抓错窗口。
- **`return true`**：MV3 `onMessage` 里异步 `sendResponse` 必须同步返回 `true` 保持通道，否则拿不到结果。
- **`retryUntilSuccess`**：`captureVisibleTab` 在标签页刚导航/未激活时会抛 `Cannot access contents of the page`，所以包了重试。

> 名字骗人：命令叫 `captureEntirePageScreenshot`（整页截图），实际只截**可见视口**，不滚动拼接。这是 Selenium IDE 命令名的历史包袱。未在源码中找到任何滚动拼接实现。

### 4.2 时机一：回放失败自动截图

`play-actions.js:1421-1437`（在失败分支的最后，无论用户选择停止还是继续都会执行）：

```js
        return browser.runtime
          .sendMessage({
            captureEntirePageScreenshot: true,
            captureWindowId: extCommand.getContentWindowId(),
          })
          .then(function (captureResponse) {
            const testCaseElement = document.getElementById(currentTestCaseId);
            const testCaseID = testCaseElement.id;
            const testCase = findTestCaseById(testCaseID);
            addToScreenshot(
              captureResponse.image,
              "fail-" + testCase.name + "-" + originalCurrentPlayingCommandIndex
            );
          })
          .catch(function (e) {
            console.log(e);
          });
```

命名规则：**`fail-<用例名>-<命令下标>`**，这个字符串同时被用作 `<a title>` 和 `<a download>` 属性（即下载文件名）。

> 时序坑：截图发生在 `await executionDialog()`（`play-actions.js:1388`）**之后**。如果用户在「继续执行？」弹窗上停留很久，或者被测页面已经跳转，抓到的将是**弹窗之后的页面状态**，未必是失败瞬间。重建时应把 capture 提到 `executionDialog()` 之前。

### 4.3 时机二：`catchPlayingError` 分支不截图

`play-actions.js:761-820` 的 `catchPlayingError`（连接断开以外的异常）里**没有截图调用**。也就是说「命令返回失败」会截图，「Promise 抛异常」不会。这是一处不一致。

### 4.4 时机三：显式命令 `captureEntirePageScreenshot`

用户可以在测试用例里写一条 `captureEntirePageScreenshot` 命令，target 就是截图标题。内容脚本转发（`content/command-receiver.js:67-76`）：

```js
} else if (request.commands === 'captureEntirePageScreenshot' || request.commands === 'captureEntirePageScreenshotAndWait') {
    browser.runtime.sendMessage({
        captureEntirePageScreenshot: true
    }).then(function(captureResponse) {
        sendResponse({
            result: 'success',
            capturedScreenshot: captureResponse.image,
            capturedScreenshotTitle: request.target
        });
    });
}
```

面板侧在**成功分支**回收（`play-actions.js:1446-1451`）：

```js
        if (result.capturedScreenshot) {
          addToScreenshot(
            result.capturedScreenshot,
            result.capturedScreenshotTitle
          );
        }
```

注意这里内容脚本发消息时**没有传 `captureWindowId`**，所以 SW 走 `sender.tab.windowId` 兜底 —— 这条路径是对的，因为 sender 就是被测页。

### 4.5 存储：全程 base64 dataURL，不落盘

`captureVisibleTab` 返回的是 `data:image/png;base64,...` 字符串。它：

1. 通过 `runtime.sendMessage` 以**字符串**形式跨进程传递；
2. 直接塞进 `<img src>` 和 `<a href>`（`kar-screenshot.js:11-12`）；
3. 被 `saveLog()` 连同 `innerHTML` 一起写进报告 HTML —— 所以**报告是自包含的**，图片内嵌，无外链。

`addToScreenshot` 全文（`panel/js/katalon/kar-screenshot.js:1-30`）：

```js
function clearScreenshotContainer() {
    $('#screenshotcontainer ul').empty();
}

function addToScreenshot(imgSrc, title) {
    if (!title) {
        title = new Date().toString();
    }
    var screenshotUl = $('#screenshotcontainer ul');
    var li = $('<li></li>');
    var a = $('<a></a>').attr('target', '_blank').attr('href', imgSrc).attr('title', title).attr('download', title).addClass('downloadable-screenshot');
    var img = $('<img>').attr('src', imgSrc).addClass('thumbnail');
    var screenshotTitle = $('<p></p>').text(title).hide();
    li.append(a.append(img)).append(screenshotTitle);
    screenshotUl.append(li);
    sideex_log.logScreenshot(imgSrc, title);
}

//for test
function addSampleDataToScreenshot() {
}

$(function() {

    $('#download-all').click(function() {
        $('.downloadable-screenshot').each(function() {
            this.click();
        });
    });
});
```

**一张图被渲染两次**：一次进 `#screenshotcontainer ul li`（Screenshots 标签页，网格布局），一次进 `#logcontainer`（Log 标签页，行内缩略图）。这也意味着**内存里同一份 base64 字符串被 DOM 引用两遍**，长时间套件回放会明显吃内存。

「Download All」的实现是**遍历所有 `<a download>` 并 `.click()`**，靠浏览器的 `download` 属性一次性触发 N 个下载 —— 不走 `downloads` API，因此不受 `saveAs` 对话框干扰，但 Chrome 会弹「此站点想要下载多个文件」的权限提示。

### 4.6 样式（`panel/css/kar.css:1466-1476`）

```css
#logcontainer img.thumbnail {
  max-width: 320px;
  max-height: 200px;
  border-radius: 3px;
}

#screenshotcontainer img.thumbnail {
  max-width: 100%;
  max-height: auto;
  border-radius: 3px;
}
```

`#screenshotcontainer ul li` 是 `display:inline-block; max-width: calc(20% - 10px)`（`kar.css:1456-1460`），即每行 5 张。

---

## 5. 报告格式与下载落地

### 5.1 `saveLog()` 全文（`panel/js/UI/services/html-service/save-log.js:1-38`）

```js
const saveLog = () => {
  var now = new Date();
  var date = now.getDate();
  var month = now.getMonth() + 1;
  var year = now.getFullYear();
  var seconds = now.getSeconds();
  var minutes = now.getMinutes();
  var hours = now.getHours();
  var f_name = year + '-' + month + '-' + date + '-' + hours + '-' + minutes + '-' + seconds + '.html';
  var logcontext = "";
  var logcontainer = document.getElementById('logcontainer');
  logcontext =
    '<!doctype html>\n' +
    '<html>\n' +
    '<head>\n' +
    '<title>' + f_name + '</title>\n' +
    '<link href="https://fonts.googleapis.com/css?family=Roboto+Mono:400,700|Roboto:400,500,700" rel="stylesheet">\n' +
    '<style>\n' +
    '.thumbnail { max-width: 320px; max-height: 200px; }\n' +
    'h4 { font-weight: normal; font-family: \'Roboto Mono\', monospace; font-size: 11px; }\n' +
    'h4.log-info { color: #333333; }\n' +
    'h4.log-error { color: #EA4335; }\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    logcontainer.innerHTML
  '</body>';
  var link = makeTextFile(logcontext);

  var downloading = browser.downloads.download({
    filename: f_name,
    url: link,
    saveAs: true,
    conflictAction: 'overwrite'
  });
}

export { saveLog }
```

**报告结构**（自上而下）：

```
<!doctype html><html><head>
  <title>2026-8-5-14-3-27.html</title>
  <link rel=stylesheet href=fonts.googleapis.com/...Roboto+Mono>
  <style> .thumbnail / h4 / h4.log-info / h4.log-error </style>
</head><body>
  <h4 class="log-info">[info] Playing test case Suite1 / Case1</h4>
  <h4 class="log-info">[info] Time: ... Timestamp: 1754...</h4>
  <h4 class="log-info">[info] OS: Windows Version: 10</h4>
  <h4 class="log-info">[info] Browser: Chrome Version: 1xx</h4>
  ...
  <h4 class="log-error">[error] Element is not found.</h4>
  <h4 class="log-info"><a target=_blank href="data:image/png;base64,..." title="fail-Case1-7" download="fail-Case1-7"><img class=thumbnail src="data:image/png;base64,..."></a></h4>
  <h4 class="log-info">[info] Test case failed</h4>
```

文件名格式 **`YYYY-M-D-H-m-s.html`**（月日时分秒**不补零**）。

### 5.2 下载落地：Blob URL + `downloads.download`

`panel/js/UI/services/helper-service/make-text-file.js:1-14`：

```js
let textFile = null;

const makeTextFile = (text) => {
    const data = new Blob([text], {
        type: 'text/*'
    });
    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
        window.URL.revokeObjectURL(textFile);
    }
    textFile = window.URL.createObjectURL(data);
    return textFile;
};
```

要点：

- **模块级单例 `textFile`**：同一个模块变量被 `saveLog`、`downloadSuite`（`panel/js/UI/services/html-service/download-suite.js:42`）共用。生成新 URL 前 revoke 上一个 —— 意味着**同时触发两次下载时，第一个 URL 会被提前 revoke**，可能导致下载失败。这是一个真实竞态。
- `type: 'text/*'` 不是合法 MIME，Chrome 会当二进制处理；对 `.html` 下载没影响，但用 `text/html` 更规范。
- `downloads.download({saveAs:true})` 会弹「另存为」对话框；`conflictAction:'overwrite'` 在 `saveAs:true` 时基本无效。
- 需要 `manifest.json:64` 的 `"downloads"` 权限。

### 5.3 无 JUnit / JSON / XML 报告

全仓库检索 `downloads.download` 只有三处：`save-log.js:30`（HTML 日志）、`download-suite.js:45`（`.krecorder`/`.json` 用例存档）、以及导出代码时的 FileSaver（`panel/index.html:74` 引入 `js/lib/FileSaver.js`）。

**未在源码中找到 JUnit XML、Allure、JSON 结果报告的生成逻辑。** 推测：Katalon 把结构化报告能力放在了云端 TestOps，本地只提供 HTML 日志。

---

## 6. TestOps 云端上报（裁剪时整块删除）

### 6.1 端点定义（`panel/js/katalon/kar.js:1-41`）

```js
var testOpsEndpoint = 'https://testops.katalon.io';
var testOpsUrls = {
  getFirstProject: `${testOpsEndpoint}/api/v1/projects/first`,
  getUploadUrl: `${testOpsEndpoint}/api/v1/files/upload-url`,
  getUploadUrlAvatar: `${testOpsEndpoint}/api/v1/files/upload-url-avatar`,
  getUserInfo: `${testOpsEndpoint}/api/v1/users/me`,
  uploadBackup: `${testOpsEndpoint}/api/v1/katalon-recorder/backup`,
  uploadTestReports: `${testOpsEndpoint}/api/v1/katalon-recorder/test-reports`,
  loginToTestOps: `${testOpsEndpoint}/login`,
  // TODO: logout from TestOps
  logoutFromTestOps: `${testOpsEndpoint}/api/v1/users/logout`,
};
```

### 6.2 上传流程（三次请求，`kar-upload.js:80-144`）

```
1) GET  /api/v1/files/upload-url?projectId=N   → { path, uploadUrl }   （预签名 S3 URL）
2) PUT  <uploadUrl>  Content-Type: text/plain  body = 日志纯文本
3) POST /api/v1/katalon-recorder/test-reports  { projectId, batch, isEnd, fileName, uploadedPath }
```

上传的正文构造（`kar-upload.js:95-100`）—— 注意这里用的是 `textContent`，**图片全部丢失**：

```js
      // see save-log button
      var logcontext = "";
      var logcontainer = document.getElementById("logcontainer");
      for (var i = 0; i < logcontainer.childNodes.length; i++) {
        logcontext = logcontext + logcontainer.childNodes[i].textContent + "\n";
      }
```

### 6.3 ⚠️ 回放结束会**自动**联网并可能自动上传

`play-actions.js:717-749` 的 `switchPS()` 在「回放结束、按钮切回 Play」时无条件发一次请求：

```js
    $.ajax({
      url: testOpsUrls.getFirstProject,
      type: "GET",
    }).then((projects) => {
      if (projects.length === 1) {
        let project = projects[0];
        uploadTestReportsToTestOps(null, project.id, true);
      } else {
        $("#ka-upload").removeClass("disable");
        sideex_log.appendA(
          "Upload this execution to Katalon TestOps",
          "ka-upload-log"
        );
        $("#ka-upload-log").click(function () {
          uploadLogToTestOps();
        });
      }
    });
```

**只要用户登录过 TestOps 且名下恰好只有 1 个项目，每次回放结束都会静默把日志上传到云端**，没有任何确认。裁剪时这是必须优先删除的点。

### 6.4 每 15 分钟自动全量备份 storage

`panel/js/UI/services/test-ops-service/test-ops-service.js:1-8`：

```js
const setBackupDataInterval = () => {
  let timerId = setTimeout(function tick() {
    getProjects().then(() => {
      backupData();
      timerId = setTimeout(tick, 15 * 60 * 1000);
    })
  }, 15 * 60 * 1000);
}
```

`backupData()`（`kar-upload.js:33-78`）执行 `browser.storage.local.get(null)` —— **把整个本地存储（所有测试用例、变量、token、设置）序列化后上传**。启动点在 `panel/js/UI/controllers/other-listeners/test-ops.js:32` `setBackupDataInterval();`。

---

## 7. 隐晦知识点与坑

### 7.1 【真实 Bug】`saveLog` 生成的 HTML 缺 `</body></html>`

`save-log.js:26-27`：

```js
    logcontainer.innerHTML
  '</body>';
```

第 26 行末尾**漏了 `+`**。ASI（自动分号插入）把它切成两条语句：赋值在 `logcontainer.innerHTML` 处结束，`'</body>';` 变成一条无副作用的表达式语句被丢弃。结果每份报告都缺闭合标签。浏览器容错能渲染，但严格解析器会报错。修复：把 26 行改为 `logcontainer.innerHTML +`。

### 7.2 报告依赖外网字体

`save-log.js:17` 内联了 `<link href="https://fonts.googleapis.com/css?family=Roboto+Mono...">`。**离线打开报告时字体请求会挂起**，且把报告发给别人等于泄露一次访问。重建时改为纯 `monospace`。

### 7.3 报告样式与面板样式是两份、且不同步

面板里 `log-info` 用的是 CSS 变量 `var(--main-txt-color)`（`kar.css:1689`，支持暗色主题），报告模板里硬编码 `#333333`（`save-log.js:21`）。改主题不会同步到报告。

### 7.4 「Clear」清日志但不清截图

`panel/js/UI/controllers/other-listeners/log.js:6-9`：

```js
    $("#clear-log").click(function(){
        $("#ka-upload").addClass("disable");
        emptyNode(document.getElementById("logcontainer"));
    })
```

只清 `#logcontainer`，`#screenshotcontainer ul` 里的图还在（只有 `initBeforePlay()` 才会调 `clearScreenshotContainer()`）。于是「Clear 后再 Save」得到空报告，但 Screenshots 页仍有上一轮的图。

### 7.5 CLI 通道白抓一张图然后扔掉

`playback/service/play-actions-service.js:992-1000`：

```js
        return browser.runtime
          .sendMessage({
            captureEntirePageScreenshot: true,
            captureWindowId: extCommand.getContentWindowId(),
          })
          .then(function (captureResponse) {})
          .catch(function (e) {
            console.log(e);
          });
```

`.then` 是空函数 —— 抓了 PNG、跨进程传了一次 base64、然后丢弃。纯浪费。

### 7.6 `sideex_log` 在 SW 里不存在

`sideex_log` 依赖 `document`，只在 `panel/index.html` 上下文有效。任何被 `worker_wrapper.js` importScripts 进 SW 的文件里都不能用它 —— 这就是为什么 `background/*.js` 里全是 `console.log`。重建时若要把回放逻辑搬进 SW，必须先设计一个「SW 发消息 → 面板渲染日志」的桥。

### 7.7 `captureVisibleTab` 的三个硬约束

1. 需要 `activeTab` 或 `<all_urls>` host 权限（`manifest.json:52,64` 都有）；
2. **抓不到 `chrome://`、Chrome Web Store、其它扩展页**，会 reject；
3. 有隐式速率限制（`MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`），密集失败的套件会触发 `Exceeded maximum number of calls`。`retryUntilSuccess` 掩盖了这个错误但会拖慢回放。

### 7.8 base64 图片让 storage 无法承载

`browser.storage.local` 单条 8KB 上限（未启用 `unlimitedStorage` 时）。Katalon 声明了 `"unlimitedStorage"`（`manifest.json:64`），但**截图从未写入 storage**，只活在 DOM 里 —— 所以**关闭面板窗口后所有截图和日志全部丢失**。`panel/js/katalon/kar-restoreData.js:71` 只检查 `logcontainer.childElementCount === 0`，并没有恢复日志内容。

### 7.9 `title` 同时当 `download` 文件名，未做非法字符过滤

`kar-screenshot.js:11` `.attr('download', title)`，而 title = `"fail-" + testCase.name + "-" + index`。用例名里若含 `/ \ : * ? " < > |`，Chrome 会静默替换或下载失败。

---

## 8. 裁剪建议

| 动作 | 目标 | 理由 |
|---|---|---|
| 🟢 保留 | `logger.js`（Log 类）、`kar-screenshot.js`、`save-log.js`、`make-text-file.js`、`background/kar.js:159-194`、`set-color.js` | 本地报告闭环的最小集合 |
| 🔴 删除 | `panel/js/katalon/kar-upload.js`（整个文件） | TestOps 上传/备份 |
| 🔴 删除 | `panel/js/UI/services/test-ops-service/`（整个目录） | 15 分钟自动备份 |
| 🔴 删除 | `panel/js/UI/controllers/other-listeners/test-ops.js` | TestOps 按钮 |
| 🔴 删除 | `panel/js/katalon/kar.js:1-41`（`testOpsEndpoint`/`testOpsUrls`/`updateTestOpsLoginToken`） | 云端端点 |
| 🔴 删除 | `play-actions.js:730-747`（`switchPS` 里的 `$.ajax(getFirstProject)` 整块） | 回放后静默联网/自动上传 |
| 🔴 删除 | `play-actions.js:739-745` 的 `sideex_log.appendA("Upload this execution…")` | 云端入口 |
| 🔴 删除 | `panel/index.html:1034` `<script src="js/katalon/kar-upload.js">`、`:967` `test-ops.js`、`:534` `#test-ops-back-up-data`、`:559` `#ka-upload` | 引用清理 |
| 🔴 删除 | `playback/` 整个目录 + `content-marketing/socket-io/socket-io.min.js` | Katalon Studio socket 联动 |
| 🟡 修复 | `save-log.js:26` 补 `+` | 报告缺闭合标签 |
| 🟡 修复 | `save-log.js:17` 去掉 googleapis 字体 | 离线可用 + 隐私 |
| 🟡 改进 | 截图移到 `executionDialog()` 之前（`play-actions.js:1388` 前） | 抓到真正的失败瞬间 |
| 🟡 改进 | `catchPlayingError`（`play-actions.js:761`）补一次截图 | 异常分支也要证据 |
| 🟡 改进 | 把 `command.status` 汇总成 JSON 报告 | 摆脱「DOM 即数据源」 |
| 🟡 改进 | `makeTextFile` 的模块级 `textFile` 改为局部变量 + 延时 revoke | 消除并发下载竞态 |

**引用清理点速查**（删除文件后必须同步改的位置）：

| 被删对象 | 需清理的引用 |
|---|---|
| `kar-upload.js` | `panel/index.html:1034`；`play-actions.js:736,744`；`test-ops.js:17,21,26,27` |
| `test-ops-service/` | `panel/js/UI/controllers/other-listeners/test-ops.js:1,32` |
| `testOpsUrls` | `panel/js/katalon/kar.js:7-17`；`play-actions.js:104,731`；`kar-upload.js:37,51,86,109,148,153,246,256,267`；`top-toolbar/actions.js:35`；`other-listeners/test-ops.js:6` |
| `playback/` | 无外部引用（独立入口，未在 manifest 注册；`playback/index.js` 由 `panel/index.html` 之外的页面加载，未在源码中找到加载点，推测：为 Katalon Studio 注入用） |

---

## 9. 最小可用实现（MVP · 本地 HTML 报告 + 失败截图）

目标：**回放失败时自动截图 → 日志与截图内嵌 → 一键导出自包含 HTML 报告 + 结构化 JSON**。总计 ~140 行，无第三方依赖（不需要 jQuery）。

### 9.1 `manifest.json` 必需片段

```json
{
  "manifest_version": 3,
  "permissions": ["tabs", "activeTab", "downloads", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "sw.js" }
}
```

### 9.2 `sw.js` —— 截图服务（18 行）

```js
// Service Worker：唯一有权调用 captureVisibleTab 的上下文
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req?.type !== "capture") return;
  const windowId = req.windowId ?? sender.tab?.windowId;
  (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        sendResponse({ ok: true, image: await chrome.tabs.captureVisibleTab(windowId, { format: "png" }) });
        return;
      } catch (e) {
        if (i === 2) sendResponse({ ok: false, error: String(e) });
        else await new Promise(r => setTimeout(r, 300));
      }
    }
  })();
  return true; // 关键：保持异步通道
});
```

### 9.3 `report.js` —— 日志模型 + 报告生成（约 120 行）

```js
/* ============ 1. 结构化日志模型（DOM 只是投影，数据才是源） ============ */
const LEVEL = { INFO: "info", WARN: "warn", ERROR: "error", SHOT: "shot" };

class RunReport {
  constructor(meta = {}) {
    this.meta = { startedAt: Date.now(), ua: navigator.userAgent, ...meta };
    this.entries = [];            // { t, level, msg, img?, title? }
    this.stats = { passed: 0, failed: 0 };
    this.container = document.getElementById("logcontainer");
  }

  _push(level, msg, extra = {}) {
    const e = { t: Date.now(), level, msg, ...extra };
    this.entries.push(e);
    this._render(e);
    return e;
  }

  info(m)  { return this._push(LEVEL.INFO, m); }
  warn(m)  { return this._push(LEVEL.WARN, m); }
  error(m) { return this._push(LEVEL.ERROR, m); }
  shot(dataUrl, title) { return this._push(LEVEL.SHOT, title, { img: dataUrl, title }); }

  pass() { this.stats.passed++; this._sync(); }
  fail() { this.stats.failed++; this._sync(); }
  _sync() {
    document.getElementById("result-runs").textContent = this.stats.passed;
    document.getElementById("result-failures").textContent = this.stats.failed;
  }

  reset() {
    this.entries = [];
    this.stats = { passed: 0, failed: 0 };
    this.container.textContent = "";
    this._sync();
  }

  _render(e) {
    const row = document.createElement("div");
    row.className = "log-" + e.level;
    if (e.level === LEVEL.SHOT) {
      const a = document.createElement("a");
      a.href = e.img; a.target = "_blank";
      a.download = String(e.title || "shot").replace(/[\\/:*?"<>|]/g, "_") + ".png";
      const img = document.createElement("img");
      img.src = e.img; img.className = "thumbnail"; img.alt = e.title || "";
      a.appendChild(img); row.appendChild(a);
    } else {
      row.textContent = `[${new Date(e.t).toLocaleTimeString()}] ${e.msg}`;
    }
    this.container.appendChild(row);
    this.container.scrollTop = this.container.scrollHeight;
  }

  /* ============ 2. 失败截图 ============ */
  async captureFailure(windowId, title) {
    const res = await chrome.runtime.sendMessage({ type: "capture", windowId });
    if (res?.ok) this.shot(res.image, title);
    else this.warn("Screenshot failed: " + res?.error);
  }

  /* ============ 3. 自包含 HTML 报告 ============ */
  toHTML() {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const body = this.entries.map(e => e.level === LEVEL.SHOT
      ? `<figure><img class="thumbnail" src="${e.img}"><figcaption>${esc(e.title || "")}</figcaption></figure>`
      : `<p class="log-${e.level}"><span class="t">${new Date(e.t).toISOString()}</span> ${esc(e.msg)}</p>`
    ).join("\n");
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>Test Report ${new Date(this.meta.startedAt).toISOString()}</title>
<style>
 body{font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;margin:24px;color:#222}
 h1{font-size:16px} .sum{margin:8px 0 20px;padding:8px 12px;background:#f5f5f5;border-radius:4px}
 .pass{color:#188038;font-weight:700} .fail{color:#EA4335;font-weight:700}
 p{margin:2px 0} .t{color:#999} .log-error{color:#EA4335} .log-warn{color:#B06000}
 figure{margin:8px 0} .thumbnail{max-width:640px;border:1px solid #ddd;border-radius:3px;display:block}
 figcaption{color:#666;font-size:11px;margin-top:2px}
</style></head><body>
<h1>Test Report</h1>
<div class="sum">
 <span class="pass">Passed ${this.stats.passed}</span> &nbsp;|&nbsp;
 <span class="fail">Failed ${this.stats.failed}</span><br>
 Started: ${new Date(this.meta.startedAt).toISOString()}<br>
 UA: ${esc(this.meta.ua)}
</div>
${body}
</body></html>`;
  }

  toJSON() {
    return JSON.stringify({ meta: this.meta, stats: this.stats, entries: this.entries }, null, 2);
  }

  /* ============ 4. 下载落地 ============ */
  async download(kind = "html") {
    const isHtml = kind === "html";
    const blob = new Blob([isHtml ? this.toHTML() : this.toJSON()],
      { type: isHtml ? "text/html;charset=utf-8" : "application/json" });
    const url = URL.createObjectURL(blob);
    const pad = n => String(n).padStart(2, "0");
    const d = new Date();
    const name = `report-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
               + `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${isHtml ? "html" : "json"}`;
    try {
      await chrome.downloads.download({ filename: name, url, saveAs: true });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60_000); // 延时 revoke，避免下载未完成即失效
    }
  }
}

window.report = new RunReport();
document.getElementById("save-log").onclick   = () => report.download("html");
document.getElementById("save-json").onclick  = () => report.download("json");
document.getElementById("clear-log").onclick  = () => report.reset();
```

### 9.4 在回放引擎里接入（3 处）

```js
// A. 开始回放
report.reset();
report.info(`Playing: ${suite.name} / ${testCase.name}`);

// B. 命令失败 —— 先截图，再弹对话框（修正原版时序）
if (result.result !== "success") {
  report.error(`#${idx} ${cmd.name}(${cmd.target}) -> ${result.result}`);
  await report.captureFailure(contentWindowId, `fail-${testCase.name}-${idx}`);
  report.fail();
  const cont = await askContinue();
  if (!cont) return stop();
}

// C. 用例结束
report.info("Test case passed"); report.pass();
```

### 9.5 与原版的差异对照

| 维度 | Katalon 原版 | MVP |
|---|---|---|
| 数据源 | DOM `innerHTML` | `entries[]` 数组，DOM 是投影 |
| 报告格式 | HTML（缺闭合标签） | HTML + JSON 双格式 |
| 字体 | 外链 googleapis | 系统等宽字体，纯离线 |
| 截图时机 | 失败对话框**之后** | 失败**立即** |
| 异常分支截图 | 无 | 同一入口，统一覆盖 |
| Blob URL | 模块单例，易竞态 | 局部变量 + 延时 revoke |
| 计数 | 数 DOM class | `stats` 对象 |
| 云端上传 | 自动/静默 | 无 |
| 代码量 | 分散在 6 个文件 | 单文件 ~140 行 |

---

## 10. 复刻检查清单

- [ ] `manifest.json` 有 `downloads`、`tabs`、`<all_urls>`；SW 里 `onMessage` 返回 `true`
- [ ] 截图消息必须带 `windowId`（被测窗口），否则可能抓到扩展面板自己
- [ ] `captureVisibleTab` 对 `chrome://`、扩展页会 reject —— 必须 try/catch 且不能中断回放
- [ ] base64 图不写 storage，只留内存；套件很长时考虑降采样（`format:"jpeg", quality:60`）
- [ ] 报告 HTML 中所有用户可控字符串（用例名、错误信息）必须 HTML 转义，防止日志注入破坏报告结构
- [ ] `download` 属性/`filename` 参数需过滤 `\ / : * ? " < > |`
- [ ] `URL.revokeObjectURL` 不要在 `download()` 返回后立刻调用（下载可能还没开始读）
- [ ] 面板关闭即丢失日志 —— 若需持久化，把 `entries`（去掉 `img` 字段）写 `storage.local`，图片单独用 IndexedDB
