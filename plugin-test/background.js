let isRecording = false;
const debuggerTabs = new Set();
const pendingReqs = {};

chrome.storage.local.get(['isRecording'], (r) => {
  isRecording = r.isRecording || false;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function updateIcon() {
  const p = isRecording ? 'icons/icon_active.png' : 'icons/icon16.png';
  chrome.action.setIcon({ path: { 16: p, 48: 'icons/icon48.png', 128: 'icons/icon128.png' } }).catch(() => {});
}

function broadcast(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => { chrome.tabs.sendMessage(tab.id, msg).catch(() => {}); });
  });
}

// ========== chrome.debugger 捕获（补充） ==========
function attachDebugger(tabId) {
  if (debuggerTabs.has(tabId)) return;
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) return;
    debuggerTabs.add(tabId);
    chrome.debugger.sendCommand({ tabId }, 'Network.enable');
  });
}

function detachDebugger(tabId) {
  if (!debuggerTabs.has(tabId)) return;
  chrome.debugger.detach({ tabId }).then(() => debuggerTabs.delete(tabId)).catch(() => debuggerTabs.delete(tabId));
}

function attachAll() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        attachDebugger(tab.id);
      }
    });
  });
}

function detachAll() {
  debuggerTabs.forEach(id => { chrome.debugger.detach({ tabId: id }).catch(() => {}); });
  debuggerTabs.clear();
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!isRecording) return;
  if (method === 'Network.requestWillBeSent') {
    const req = params.request;
    if (!shouldCapture(req.url)) return;
    pendingReqs[params.requestId] = {
      url: req.url, method: req.method, headers: req.headers || {},
      body: req.postData || null, timestamp: Date.now(), tabId: source.tabId
    };
  }
  if (method === 'Network.responseReceived') {
    if (!shouldCapture(params.response.url)) return;
    const p = pendingReqs[params.requestId];
    const data = {
      url: p ? p.url : params.response.url,
      method: p ? p.method : (params.response.requestMethod || 'GET'),
      headers: p ? p.headers : {},
      body: p ? p.body : null,
      status: params.response.status,
      statusText: params.response.statusText || '',
      responseHeaders: params.response.headers || {},
      response: null,
      duration: p ? Date.now() - p.timestamp : 0,
      timestamp: p ? p.timestamp : Date.now(),
      apiType: getType(p ? p.url : params.response.url),
      tabId: source.tabId
    };
    chrome.debugger.sendCommand({ tabId: source.tabId }, 'Network.getResponseBody', { requestId: params.requestId }, (resp) => {
      if (resp && resp.body) {
        try { data.response = JSON.parse(resp.body); } catch(e) { data.response = resp.body; }
      }
      saveApi(data);
      if (p) delete pendingReqs[params.requestId];
    });
  }
});

chrome.tabs.onRemoved.addListener((id) => debuggerTabs.delete(id));

// ========== 工具函数 ==========
function shouldCapture(url) {
  if (!url) return false;
  return !/^(chrome-extension|chrome|edge|about|data|blob|file):/.test(url);
}

function getType(u) {
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)(\?|$)/i.test(u)) return 'static';
  if (/\b(log|track|report|analytics|beacon|collect|stat|monitor)\b/i.test(u)) return 'track';
  return 'api';
}

function saveApi(data) {
  if (!shouldCapture(data.url)) return;
  if (data.apiType === 'static') return;
  chrome.storage.local.get(['recordedApis'], (r) => {
    const apis = r.recordedApis || [];
    const dup = apis.some(a => a.url === data.url && a.method === data.method && Math.abs(a.timestamp - data.timestamp) < 2000);
    if (!dup) {
      apis.push(data);
      chrome.storage.local.set({ recordedApis: apis });
    }
  });
}

// ========== 消息处理 ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_RECORDING') {
    isRecording = true;
    chrome.storage.local.set({ isRecording: true });
    updateIcon();
    broadcast({ type: 'START_RECORDING' });
    attachAll();
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_RECORDING') {
    isRecording = false;
    chrome.storage.local.set({ isRecording: false });
    updateIcon();
    broadcast({ type: 'STOP_RECORDING' });
    detachAll();
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATUS') {
    sendResponse({ isRecording });
  } else if (msg.type === 'SAVE_API') {
    saveApi(msg.data);
    sendResponse({ ok: true });
  } else if (msg.type === 'CLEAR_APIS') {
    chrome.storage.local.set({ recordedApis: [] });
    sendResponse({ ok: true });
  } else if (msg.type === 'DELETE_API') {
    chrome.storage.local.get(['recordedApis'], (r) => {
      const apis = r.recordedApis || [];
      apis.splice(msg.index, 1);
      chrome.storage.local.set({ recordedApis: apis });
      sendResponse({ ok: true });
    });
    return true;
  } else if (msg.type === 'UPDATE_API_NAME') {
    chrome.storage.local.get(['recordedApis'], (r) => {
      const apis = r.recordedApis || [];
      if (apis[msg.index]) { apis[msg.index].nodeName = msg.nodeName; chrome.storage.local.set({ recordedApis: apis }); }
      sendResponse({ ok: true });
    });
    return true;
  }
  return true;
});

// 页面加载时自动注入
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' && isRecording) {
    attachDebugger(tabId);
  }
});

updateIcon();
