// 加载固定配置（前后端地址等，不可由用户修改）。config.js 同时兼容
// Service Worker(self) 与页面(window) 环境。
try { importScripts('config.js'); } catch (e) { console.warn('[AutoTest][bg] config.js 加载失败', e); }
var CFG = (typeof AUTOTEST_CONFIG !== 'undefined') ? AUTOTEST_CONFIG
  : { PLATFORM_URL: 'http://localhost:9093', FRONTEND_URL: 'http://localhost:9094' };

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

function activateWindow(interactionType, selector, pageUrl, tabId) {
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
      pageUrl: pageUrl,
      tabId: tabId != null ? tabId : null
    };
  } else {
    currentTrace.step++;
    currentTrace.expiresAt = Date.now() + WINDOW_MS;
    if (tabId != null) currentTrace.tabId = tabId;
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

// 入口：独立窗口（选项 A）。chrome.sidePanel 需 Chrome 114+，
// 低版本(90/100)不存在，直接调用会在顶层抛 TypeError，导致后续所有监听器
// 无法注册 —— 这是 Chrome 114- 不兼容的根因，必须做存在性判断。
function openPanelWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('sidepanel.html'),
    type: 'popup',
    width: 460,
    height: 760
  }, function (win) {
    if (chrome.runtime.lastError) {
      console.warn('[AutoTest][bg] openPanelWindow 失败:', chrome.runtime.lastError.message);
      return;
    }
    // 记忆窗口尺寸（可选增强）
    chrome.storage.local.get(['panelWindowSize'], function (r) {
      if (r.panelWindowSize) chrome.windows.update(win.id, r.panelWindowSize);
    });
  });
}

if (chrome.sidePanel) {
  // 仅在高版本关闭 sidePanel 自动打开，避免与独立窗口入口冲突
  try { chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(function(){}); } catch (e) {}
}

chrome.action.onClicked.addListener(function () {
  openPanelWindow();
});

function updateIcon() {
  const p = isRecording ? 'icons/icon_active.png' : 'icons/icon16.png';
  try {
    var ri = chrome.action.setIcon({ path: { 16: p, 48: 'icons/icon48.png', 128: 'icons/icon128.png' } });
    if (ri && typeof ri.catch === 'function') ri.catch(function(){});
  } catch (e) {}
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
  debuggerTabs.delete(tabId);
  try {
    var pd = chrome.debugger.detach({ tabId });
    if (pd && typeof pd.catch === 'function') pd.catch(function(){});
  } catch (e) {}
}

let cdpCaptureEnabled = false; // 默认关闭 CDP 全量抓包（避免调试横幅与噪音请求），仅设置开启时 attach

function attachAll() {
  if (!cdpCaptureEnabled) return;
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        attachDebugger(tab.id);
      }
    });
  });
}

function detachAll() {
  debuggerTabs.forEach(function(id) {
    try {
      var pd = chrome.debugger.detach({ tabId: id });
      if (pd && typeof pd.catch === 'function') pd.catch(function(){});
    } catch (e) {}
  });
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
    // 注入 bizOperTraceId 到 CDP 捕获的请求（按 tabId 关联，避免跨标签页串号）
    if (currentTrace && currentTrace.windowActive && currentTrace.traceId) {
      if (currentTrace.tabId == null || currentTrace.tabId === source.tabId) {
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
  if (typeof document === 'undefined') return; // Service Worker 无 DOM，跳过
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
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('解密沙箱在 Service Worker 中不可用（需页面环境）'));
  }
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
  // 仅保存业务请求：fetch/XHR 或 API 类型；过滤文档/样式/图片/字体/脚本/媒体/埋点等噪音
  if (data.resourceType !== 'fetch_xhr' && data.apiType !== 'api') return;
  chrome.storage.local.get(['recordedApis'], (r) => {
    const apis = r.recordedApis || [];
    const duplicateKey = `${data.method || 'GET'} ${data.url || ''} ${data.body || ''}`;
    const recentSame = apis.find(a => {
      const existingKey = a.duplicateKey || `${a.method || 'GET'} ${a.url || ''} ${a.body || ''}`;
      return existingKey === duplicateKey && Math.abs((a.timestamp || 0) - (data.timestamp || 0)) < 2000;
    });
    const urlText = String(data.url || '').toLowerCase();
    const isNoise = data.method === 'OPTIONS' || /\b(log|track|report|analytics|beacon|collect|stat|monitor)\b/i.test(urlText);
    const isPolling = apis.some(a => a.url === data.url && a.method === data.method && Math.abs((a.timestamp || 0) - (data.timestamp || 0)) < 8000);
    data.duplicateKey = duplicateKey;
    data.captureCategory = isNoise ? 'NOISE' : (recentSame ? 'DUPLICATE' : (isPolling ? 'POLLING' : 'BUSINESS'));
    data.captureReason = isNoise ? '埋点、预检或系统噪声' : (recentSame ? '短时间内重复请求' : (isPolling ? '相同接口短时间重复出现' : '用户操作窗口内的业务请求'));
    data.selected = data.captureCategory === 'BUSINESS';
    data.ignore = !data.selected;
    if (!recentSame) {
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
      cdpCaptureEnabled = currentSettings.cdpCapture === true;
      // 默认关闭 CDP 全量抓包：仅当设置开启时才 attach debugger（避免调试横幅与噪音请求）
      if (cdpCaptureEnabled) attachAll();
    });
    chrome.storage.local.set({ isRecordingApi: true, isRecordingMacro: true });
    updateIcon();
    // 动态注入 content.js 到所有标签页
    injectContentScripts();
    broadcast({ type: 'START_RECORDING' });
    broadcast({ type: 'START_MACRO_RECORDING' });
    // attachAll() 已移入上面 storage 回调中按需执行（受 cdpCapture 开关控制）
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
  } else if (msg.type === 'SET_CDP_CAPTURE') {
    cdpCaptureEnabled = msg.enabled === true;
    if (cdpCaptureEnabled) { if (isRecording) attachAll(); }
    else { detachAll(); }
    sendResponse({ ok: true });
  } else if (msg.type === 'TRIGGER_INTERACTION') {
    // 用户交互触发 → 激活窗口（记录触发所在 tab，用于后续按 tab 关联请求）
    if (isRecording) {
      var trigTabId = (sender && sender.tab) ? sender.tab.id : null;
      activateWindow(msg.interactionType, msg.selector, msg.pageUrl, trigTabId);
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
  } else if (msg.type === 'SYNC_PLATFORM_TOKEN') {
    // 从已登录的平台前端页面读取 localStorage 中的登录态（autotest_token / autotest_user）
    chrome.storage.local.get(['settings'], (r) => {
      var settings = r.settings || {};
      var frontendUrl = (CFG.FRONTEND_URL || '').replace(/\/+$/, '');
      if (!frontendUrl) { sendResponse({ ok: false, error: '未配置前端地址' }); return; }
      var origin;
      try { origin = new URL(frontendUrl).origin; } catch (e) { sendResponse({ ok: false, error: '地址解析失败' }); return; }
      chrome.tabs.query({}, (tabs) => {
        var target = null;
        for (var i = 0; i < tabs.length; i++) {
          try { if (new URL(tabs[i].url).origin === origin) { target = tabs[i]; break; } } catch (e) {}
        }
        if (!target) { sendResponse({ ok: false, error: '未找到已登录的平台页面' }); return; }
        chrome.scripting.executeScript({
          target: { tabId: target.id },
          function: () => ({
            token: localStorage.getItem('autotest_token'),
            user: localStorage.getItem('autotest_user')
          })
        }, (results) => {
          if (chrome.runtime.lastError || !results || !results[0]) {
            sendResponse({ ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || '读取失败' });
            return;
          }
          var res = results[0].result || {};
          sendResponse({ ok: true, token: res.token || null, user: res.user || null });
        });
      });
    });
    return true;
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
  return true;
});

// 页面加载时自动注入
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' && isRecording && cdpCaptureEnabled) {
    attachDebugger(tabId);
  }
});

updateIcon();
