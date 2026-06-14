let isRecording = false;
const debuggerTabs = new Set();
const pendingReqs = {};
let currentSettings = {};

chrome.storage.local.get(['isRecording', 'settings'], (r) => {
  isRecording = r.isRecording || false;
  currentSettings = r.settings || {};
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings && changes.settings.newValue) {
    currentSettings = changes.settings.newValue;
  }
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
    const cdpType = params.type || 'Other';
    const typeMap = { 'XHR': 'fetch_xhr', 'Fetch': 'fetch_xhr', 'Document': 'document', 'Stylesheet': 'stylesheet', 'Image': 'image', 'Media': 'media', 'Font': 'font', 'Script': 'script', 'WebSocket': 'websocket' };
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
      resourceType: typeMap[cdpType] || 'other',
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
  // 1. 基础协议过滤
  if (/^(chrome-extension|chrome|edge|about|data|blob|file):/.test(url)) return false;
  // 2. 读取缓存的过滤设置
  const s = currentSettings || {};
  const mode = s.filterMode || 'off';
  if (mode === 'off') return true;
  const kwText = (s.ignoreKeywords || '').trim();
  const domText = (s.ignoreDomains || '').trim();
  if (!kwText && !domText) return true;
  const kwList = kwText.split('\n').map(l => l.trim()).filter(Boolean);
  const domList = domText.split('\n').map(l => l.trim()).filter(Boolean);
  const hasRule = kwList.length > 0 || domList.length > 0;
  if (!hasRule) return true;
  // 忽略模式：匹配关键词或域名 → 不录制
  if (mode === 'ignore') {
    for (let i = 0; i < kwList.length; i++) {
      if (url.indexOf(kwList[i]) !== -1) return false;
    }
    try {
      const u = new URL(url);
      for (let j = 0; j < domList.length; j++) {
        if (u.hostname === domList[j] || u.hostname.endsWith('.' + domList[j])) return false;
      }
    } catch(e) {}
    return true;
  }
  // 白名单模式：匹配关键词或域名 → 才录制
  if (mode === 'whitelist') {
    for (let k = 0; k < kwList.length; k++) {
      if (url.indexOf(kwList[k]) !== -1) return true;
    }
    try {
      const u2 = new URL(url);
      for (let m = 0; m < domList.length; m++) {
        if (u2.hostname === domList[m] || u2.hostname.endsWith('.' + domList[m])) return true;
      }
    } catch(e) {}
    return false;
  }
  return true;
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
    chrome.storage.local.get(['settings'], (r) => {
      currentSettings = r.settings || {};
    });
    chrome.storage.local.set({ isRecordingApi: true });
    updateIcon();
    broadcast({ type: 'START_RECORDING' });
    attachAll();
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_RECORDING') {
    isRecording = false;
    chrome.storage.local.set({ isRecordingApi: false });
    updateIcon();
    broadcast({ type: 'STOP_RECORDING' });
    detachAll();
    sendResponse({ ok: true });
  } else if (msg.type === 'START_MACRO_RECORDING') {
    chrome.storage.local.set({ isRecordingMacro: true });
    broadcast({ type: 'START_RECORDING' });
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_MACRO_RECORDING') {
    chrome.storage.local.set({ isRecordingMacro: false });
    broadcast({ type: 'STOP_RECORDING' });
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
  } else if (msg.type === 'SAVE_MACRO_ACTION') {
    chrome.storage.local.get(['macroActions'], (r) => {
      const list = r.macroActions || [];
      list.push(msg.action);
      chrome.storage.local.set({ macroActions: list });
    });
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_MACRO_ACTIONS') {
    chrome.storage.local.get(['macroActions'], (r) => {
      sendResponse({ actions: r.macroActions || [] });
    });
    return true;
  } else if (msg.type === 'CLEAR_MACRO_ACTIONS') {
    chrome.storage.local.set({ macroActions: [] });
    sendResponse({ ok: true });
  } else if (msg.type === 'START_MACRO_REPLAY') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'START_MACRO_REPLAY', actions: msg.actions, settings: msg.settings });
      }
    });
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_MACRO_REPLAY') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_MACRO_REPLAY' });
      }
    });
    sendResponse({ ok: true });
  } else if (msg.type === 'MACRO_REPLAY_DONE') {
    chrome.storage.local.set({ macroReplayResult: msg.result });
    sendResponse({ ok: true });
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
