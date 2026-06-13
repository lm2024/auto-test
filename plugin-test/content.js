// inject.js 注入到页面上下文
var s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(s);
s.onload = function() { s.remove(); };

// 监听 inject.js 的消息，转发到 background
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'AUTOTEST_API_REQUEST') {
    try {
      chrome.runtime.sendMessage({ type: 'SAVE_API', data: event.data.data }, function() {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
    } catch(e) {}
  }
});

// 监听 background 消息，转发 recording 状态到 inject.js
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === 'START_RECORDING' || msg.type === 'STOP_RECORDING') {
    window.postMessage({ type: 'AUTOTEST_RECORDING_STATE', isRecording: msg.type === 'START_RECORDING' }, '*');
  }
});
