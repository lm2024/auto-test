let isRecording = false;
const debuggerTabs = new Set();
const pendingReqs = {};
let currentSettings = {};
const capturedTokens = {}; // Phase 4: SSO token capture

// ========== 窗口状态机 ==========
let windowState = 'IDLE'; // IDLE | ACTIVE
let currentTrace = null;
let windowTimer = null;
const WINDOW_MS = 3000;    // 单次窗口时长（可配置）
const MAX_WINDOW_MS = 5000; // 最大窗口时长（可配置）

function generateTraceId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(16).substring(2, 6);
  return 'biz_' + ts + '_' + rand;
}

function activateWindow(interactionType, selector, pageUrl) {
  if (windowState === 'IDLE') {
    currentTrace = {
      traceId: generateTraceId(),
      step: 1,
      windowActive: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + WINDOW_MS,
      windowId: 'win_' + Date.now().toString(36),
      interactionType: interactionType,
      selector: selector,
      pageUrl: pageUrl
    };
  } else {
    currentTrace.step++;
    currentTrace.expiresAt = Date.now() + WINDOW_MS;
  }
  windowState = 'ACTIVE';
  resetWindowTimer();
  broadcastTraceUpdate();
}

function resetWindowTimer() {
  if (windowTimer) clearTimeout(windowTimer);
  windowTimer = setTimeout(closeWindow, WINDOW_MS);
}

function closeWindow() {
  if (currentTrace) {
    currentTrace.windowActive = false;
  }
  windowState = 'IDLE';
  windowTimer = null;
  broadcastTraceUpdate();
  chrome.storage.local.set({ bizTraceState: { windowState, currentTrace } });
}

function broadcastTraceUpdate() {
  broadcast({ type: 'BIZ_TRACE_UPDATE', trace: currentTrace });
}

function handleWindowExtend() {
  if (windowState !== 'ACTIVE' || !currentTrace) return;
  // 检查是否超过最大窗口时长
  if (Date.now() - currentTrace.createdAt >= MAX_WINDOW_MS) {
    closeWindow();
    return;
  }
  // 重置倒计时
  if (windowTimer) clearTimeout(windowTimer);
  windowTimer = setTimeout(closeWindow, WINDOW_MS);
}

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

chrome.action.onClicked.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true }).then(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  });
});

function updateIcon() {
  const p = isRecording ? 'icons/icon_active.png' : 'icons/icon16.png';
  chrome.action.setIcon({ path: { 16: p, 48: 'icons/icon48.png', 128: 'icons/icon128.png' } }).catch(() => {});
}

function safeSendMessageToTab(tabId, msg) {
  try {
    chrome.tabs.sendMessage(tabId, msg, () => {
      if (chrome.runtime.lastError) {
        console.log('[AutoTest][bg] sendToTab FAIL tabId:', tabId, chrome.runtime.lastError.message);
      } else {
        console.log('[AutoTest][bg] sendToTab OK tabId:', tabId, msg.type);
      }
    });
  } catch(e) {
    console.log('[AutoTest][bg] sendToTab EXCEPTION tabId:', tabId, e.message);
  }
}

function broadcast(msg) {
  try {
    chrome.tabs.query({}, (tabs) => {
      console.log('[AutoTest][bg] broadcast to', tabs.length, 'tabs, msg:', msg.type);
      tabs.forEach(tab => {
        console.log('[AutoTest][bg]   tab:', tab.id, tab.url ? tab.url.substring(0, 50) : 'no-url');
        safeSendMessageToTab(tab.id, msg);
      });
    });
  } catch(e) {}
}

// 动态注入 content.js 到所有标签页（解决已打开页面没有 content script 的问题）
function injectContentScripts() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(() => {});
    });
  });
}

// ========== chrome.debugger 捕获（补充） ==========
function attachDebugger(tabId) {
  if (debuggerTabs.has(tabId)) return;
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) return;
    debuggerTabs.add(tabId);
    chrome.debugger.sendCommand({ tabId }, 'Network.enable', {}, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
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
      body: req.postData || null, timestamp: Date.now(), tabId: source.tabId,
      redirectChain: params.redirectResponse ? params.redirectChain || [] : []
    };
    // Phase 4: SSO redirect detection - record redirect chain
    if (params.redirectResponse) {
      const redirData = pendingReqs[params.requestId];
      redirData.isRedirect = true;
      redirData.redirectFrom = params.redirectResponse.url;
      redirData.redirectStatus = params.redirectResponse.status;
    }
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
    // Phase 4: Extract auth tokens from response
    extractAuthTokens(data);
    // Phase 4: SSO redirect - if 301/302, track the redirect chain
    if (data.status === 301 || data.status === 302) {
      const location = data.responseHeaders && (data.responseHeaders.location || data.responseHeaders.Location);
      if (location) {
        data.ssoRedirect = true;
        data.redirectLocation = location;
      }
    }
    // 注入 bizOperTraceId 到 CDP 捕获的请求
    if (currentTrace && currentTrace.windowActive && currentTrace.traceId) {
      data.bizOperTraceId = currentTrace.traceId;
      data.windowActive = true;
      data.windowId = currentTrace.windowId;
      data.triggerEvent = currentTrace.interactionType || 'auto';
      data.targetDom = currentTrace.selector || '';
      data.pageUrl = '';
      data.ignore = false;
      // 延长窗口
      handleWindowExtend();
    }
    chrome.debugger.sendCommand({ tabId: source.tabId }, 'Network.getResponseBody', { requestId: params.requestId }, (resp) => {
      if (chrome.runtime.lastError) {
        saveApi(data);
        if (p) delete pendingReqs[params.requestId];
        return;
      }
      if (resp && resp.body) {
        try { data.response = JSON.parse(resp.body); } catch(e) { data.response = resp.body; }
        // Phase 4: Extract tokens from response body
        extractTokensFromBody(data.response, data.url);
      }
      saveApi(data);
      if (p) delete pendingReqs[params.requestId];
    });
  }
});

chrome.tabs.onRemoved.addListener((id) => {
  debuggerTabs.delete(id);
  // 清理该 tab 的 pending 请求
  Object.keys(pendingReqs).forEach(key => {
    if (pendingReqs[key].tabId === id) delete pendingReqs[key];
  });
});

// ========== Phase 4: Token 提取 ==========
function extractAuthTokens(data) {
  if (!data) return;
  const respHeaders = data.responseHeaders || {};
  const reqHeaders = data.headers || {};

  // 1. Extract from Set-Cookie
  const setCookie = respHeaders['set-cookie'] || respHeaders['Set-Cookie'];
  if (setCookie) {
    const cookies = setCookie.split(',').map(c => c.trim().split(';')[0]);
    cookies.forEach(c => {
      const [name, ...valParts] = c.split('=');
      if (name && valParts.length) {
        const val = valParts.join('=');
        if (/^(token|session|auth|jwt|access|sid|jsessionid|connect\.sid)$/i.test(name.trim())) {
          capturedTokens[name.trim()] = val;
        }
      }
    });
  }

  // 2. Extract from Authorization header
  const auth = reqHeaders['authorization'] || reqHeaders['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    capturedTokens['accessToken'] = auth.substring(7);
  }

  // 3. Extract from response URL query params
  try {
    const u = new URL(data.url);
    const at = u.searchParams.get('access_token');
    const code = u.searchParams.get('code');
    const ticket = u.searchParams.get('ticket');
    if (at) capturedTokens['accessToken'] = at;
    if (code) capturedTokens['authCode'] = code;
    if (ticket) capturedTokens['ssoTicket'] = ticket;
  } catch(e) {}
}

function extractTokensFromBody(body, url) {
  if (!body || typeof body !== 'object') return;
  const tokenFields = ['token', 'access_token', 'accessToken', 'refresh_token', 'refreshToken', 'id_token', 'idToken'];
  tokenFields.forEach(f => {
    if (body[f] && typeof body[f] === 'string' && body[f].length > 10) {
      capturedTokens[f] = body[f];
      // Parse JWT exp if present
      if (f.includes('access') || f === 'token' || f === 'id_token') {
        try {
          const parts = body[f].split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp) capturedTokens['expiresAt'] = payload.exp * 1000;
          }
        } catch(e) {}
      }
    }
  });
}

// ========== Phase 4: 加密请求解密沙箱 ==========
let sandboxIframe = null;
let sandboxCallbacks = {};

function initSandbox() {
  if (sandboxIframe) return;
  sandboxIframe = document.createElement('iframe');
  sandboxIframe.src = chrome.runtime.getURL('sandbox.html');
  sandboxIframe.style.display = 'none';
  sandboxIframe.sandbox = 'allow-scripts';
  document.body.appendChild(sandboxIframe);
  window.addEventListener('message', (e) => {
    if (e.source !== sandboxIframe?.contentWindow) return;
    const { id, result, error } = e.data;
    if (sandboxCallbacks[id]) {
      if (error) sandboxCallbacks[id].reject(error);
      else sandboxCallbacks[id].resolve(result);
      delete sandboxCallbacks[id];
    }
  });
}

function decryptInSandbox(code, data) {
  return new Promise((resolve, reject) => {
    initSandbox();
    const id = 'dec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    sandboxCallbacks[id] = { resolve, reject };
    sandboxIframe.contentWindow.postMessage({ id, code, data }, '*');
    setTimeout(() => {
      if (sandboxCallbacks[id]) {
        sandboxCallbacks[id].reject('Sandbox timeout');
        delete sandboxCallbacks[id];
      }
    }, 5000);
  });
}

// ========== 工具函数 ==========
function shouldCapture(url) {
  if (!url) return false;
  if (/^(chrome-extension|chrome|edge|about|data|blob|file):/.test(url)) return false;
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
  // 时间窗口过滤：如果当前没有活跃窗口，且请求没有 bizOperTraceId，则不保存
  if (windowState === 'IDLE' && !data.bizOperTraceId) {
    // 允许没有窗口时也保存（兼容旧模式），但标记为未分组
    data.bizOperTraceId = data.bizOperTraceId || '';
    data.windowActive = false;
  }
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
  try {
    if (msg.type === 'START_RECORDING') {
    isRecording = true;
    chrome.storage.local.get(['settings'], (r) => {
      currentSettings = r.settings || {};
    });
    chrome.storage.local.set({ isRecordingApi: true, isRecordingMacro: true });
    updateIcon();
    // 动态注入 content.js 到所有标签页
    injectContentScripts();
    broadcast({ type: 'START_RECORDING' });
    broadcast({ type: 'START_MACRO_RECORDING' });
    attachAll();
    // 初始化 Trace 状态
    windowState = 'IDLE';
    currentTrace = null;
    if (windowTimer) { clearTimeout(windowTimer); windowTimer = null; }
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_RECORDING') {
    isRecording = false;
    // 关闭当前窗口
    if (windowTimer) { clearTimeout(windowTimer); windowTimer = null; }
    windowState = 'IDLE';
    currentTrace = null;
    chrome.storage.local.set({ isRecordingApi: false, isRecordingMacro: false, bizTraceState: null });
    updateIcon();
    broadcast({ type: 'STOP_RECORDING' });
    broadcast({ type: 'STOP_MACRO_RECORDING' });
    broadcast({ type: 'BIZ_TRACE_UPDATE', trace: null });
    detachAll();
    sendResponse({ ok: true });
  } else if (msg.type === 'TRIGGER_INTERACTION') {
    // 用户交互触发 → 激活窗口
    if (isRecording) {
      activateWindow(msg.interactionType, msg.selector, msg.pageUrl);
    }
    sendResponse({ ok: true });
  } else if (msg.type === 'WINDOW_EXTEND') {
    handleWindowExtend();
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_BIZ_TRACE_STATE') {
    sendResponse({ windowState, currentTrace });
  } else if (msg.type === 'START_MACRO_RECORDING') {
    chrome.storage.local.set({ isRecordingMacro: true });
    console.log('[AutoTest][bg] broadcasting START_MACRO_RECORDING');
    broadcast({ type: 'START_MACRO_RECORDING' });
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_MACRO_RECORDING') {
    chrome.storage.local.set({ isRecordingMacro: false });
    broadcast({ type: 'STOP_MACRO_RECORDING' });
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATUS') {
    sendResponse({ isRecording, windowState, currentTrace });
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
      console.log('[AutoTest][SAVE_MACRO_ACTION] total actions now:', list.length, 'type:', msg.action.type, 'pageUrl:', msg.action.pageUrl ? msg.action.pageUrl.substring(0, 60) : '');
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
  } else if (msg.type === 'GET_AUTH_CONTEXT') {
    sendResponse({ tokens: capturedTokens });
  } else if (msg.type === 'DECRYPT_DATA') {
    const decryptCode = msg.code || '';
    const encryptedData = msg.data || '';
    decryptInSandbox(decryptCode, encryptedData).then(result => {
      sendResponse({ ok: true, result });
    }).catch(err => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  } else if (msg.type === 'SAVE_ENCRYPT_CONFIG') {
    chrome.storage.local.set({ encryptConfig: msg.config || {} });
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_ENCRYPT_CONFIG') {
    chrome.storage.local.get(['encryptConfig'], (r) => {
      sendResponse({ config: r.encryptConfig || {} });
    });
    return true;
  }
  } catch(e) {}
  try {
    if (msg.type === 'HIDE_SIDE_PANEL') {
      chrome.sidePanel.setOptions({ enabled: false }).then(() => {
        sendResponse({ ok: true });
      }).catch((e) => {
        sendResponse({ ok: false, error: e.message });
      });
      return true;
    }
  } catch(e) {}
  return true;
});

// 页面加载时自动注入
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' && isRecording) {
    attachDebugger(tabId);
  }
});

updateIcon();
