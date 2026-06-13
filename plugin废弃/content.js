// 最简测试 - 确认 content script 是否注入
console.log('========== [录制助手] content script 已加载 ==========');
console.log('当前页面:', location.href);
console.log('时间:', new Date().toLocaleString());

var isRecording = false;

chrome.storage.local.get(['isRecording'], function(r) {
  isRecording = r.isRecording || false;
  console.log('[录制助手] 从storage读取 isRecording =', isRecording);
});

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area === 'local' && changes.isRecording) {
    isRecording = changes.isRecording.newValue;
    console.log('[录制助手] isRecording 变更为', isRecording);
  }
});

chrome.runtime.onMessage.addListener(function(msg) {
  console.log('[录制助手] 收到消息:', JSON.stringify(msg));
  if (msg.type === 'START_RECORDING') isRecording = true;
  else if (msg.type === 'STOP_RECORDING') isRecording = false;
});

function getType(u) {
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)(\?|$)/i.test(u)) return 'static';
  if (/\b(log|track|report|analytics|beacon|collect|stat|monitor)\b/i.test(u)) return 'track';
  return 'api';
}

function save(d) {
  if (d.apiType === 'static') return;
  console.log('[录制助手] >>> 捕获请求:', d.method, d.url);
  try { chrome.runtime.sendMessage({ type: 'SAVE_API', data: d }); } catch(e) {
    console.log('[录制助手] sendMessage 失败:', e.message);
  }
}

// ========== fetch ==========
var origFetch = window.fetch;
window.fetch = function() {
  console.log('[录制助手] fetch 拦截, isRecording=' + isRecording);
  if (!isRecording) return origFetch.apply(this, arguments);
  var st = Date.now(), input = arguments[0], init = arguments[1] || {};
  var url, method = 'GET', headers = {}, body = null;
  if (typeof input === 'string') { url = input; method = init.method || 'GET'; }
  else if (input instanceof Request) { url = input.url; method = init.method || input.method || 'GET'; }
  else { url = String(input); method = init.method || 'GET'; }
  if (init.headers) {
    if (init.headers instanceof Headers) init.headers.forEach(function(v, k) { headers[k] = v; });
    else if (typeof init.headers === 'object') Object.assign(headers, init.headers);
  }
  if (init.body != null) {
    if (typeof init.body === 'string') body = init.body;
    else if (init.body instanceof URLSearchParams) body = init.body.toString();
    else if (init.body instanceof FormData) body = '[FormData]';
    else try { body = JSON.stringify(init.body); } catch(e) { body = '[Object]'; }
  }
  var m = method.toUpperCase(), u = url, h = Object.assign({}, headers), b = body;
  return origFetch.apply(this, arguments).then(function(r) {
    var dur = Date.now() - st;
    var respH = {};
    r.headers.forEach(function(v, k) { respH[k] = v; });
    var cl = r.clone();
    cl.text().then(function(rt) {
      if (!isRecording) return;
      save({ url: u, method: m, headers: h, body: b, status: r.status, statusText: r.statusText, responseHeaders: respH, response: rt, duration: dur, timestamp: Date.now(), apiType: getType(u) });
    }).catch(function() {});
    return r;
  }).catch(function(e) {
    if (isRecording) save({ url: u, method: m, headers: h, body: b, status: 0, statusText: 'Error', responseHeaders: {}, response: e.message || 'Error', duration: Date.now() - st, timestamp: Date.now(), apiType: getType(u) });
    throw e;
  });
};

// ========== XHR ==========
var XHR = XMLHttpRequest.prototype, oOpen = XHR.open, oSend = XHR.send, oSet = XHR.setRequestHeader;
XHR.open = function(m, u) { this._at = { method: m.toUpperCase(), url: u, headers: {}, body: null, st: Date.now() }; return oOpen.apply(this, arguments); };
XHR.setRequestHeader = function(n, v) { if (this._at) this._at.headers[n] = v; return oSet.apply(this, arguments); };
XHR.send = function(b) {
  if (this._at) {
    if (b != null) {
      if (typeof b === 'string') this._at.body = b;
      else if (b instanceof URLSearchParams) this._at.body = b.toString();
      else if (b instanceof FormData) this._at.body = '[FormData]';
      else try { this._at.body = JSON.stringify(b); } catch(e) { this._at.body = '[Object]'; }
    }
    var self = this;
    this.addEventListener('load', function() {
      console.log('[录制助手] XHR load, isRecording=' + isRecording);
      if (!isRecording || !self._at) return;
      var t = self._at;
      var respH = {};
      var hdrStr = self.getAllResponseHeaders();
      if (hdrStr) hdrStr.split('\r\n').forEach(function(l) {
        var i = l.indexOf(':');
        if (i > 0) respH[l.substring(0, i).trim()] = l.substring(i + 1).trim();
      });
      save({ url: t.url, method: t.method, headers: Object.assign({}, t.headers), body: t.body, status: self.status, statusText: self.statusText, responseHeaders: respH, response: self.responseText, duration: Date.now() - t.st, timestamp: Date.now(), apiType: getType(t.url) });
    });
    this.addEventListener('error', function() {
      if (!isRecording || !self._at) return;
      save({ url: self._at.url, method: self._at.method, headers: self._at.headers, body: self._at.body, status: 0, statusText: 'Error', responseHeaders: {}, response: 'Network Error', duration: Date.now() - self._at.st, timestamp: Date.now(), apiType: getType(self._at.url) });
    });
  }
  return oSend.apply(this, arguments);
};

// ========== form ==========
document.addEventListener('submit', function(e) {
  if (!isRecording) return;
  var form = e.target;
  if (form.tagName !== 'FORM') return;
  var method = (form.method || 'GET').toUpperCase();
  var url = form.action || location.href;
  var body = null;
  if (method !== 'GET') {
    var fd = new FormData(form);
    var pairs = [];
    fd.forEach(function(v, k) { pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
    body = pairs.join('&');
  }
  save({ url: url, method: method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, status: 200, statusText: 'Form Submit', responseHeaders: {}, response: null, duration: 0, timestamp: Date.now(), apiType: 'api' });
}, true);
