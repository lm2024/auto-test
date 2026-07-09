// content.js - 注入到页面上下文，负责录制HTTP请求 + 宏操作录制
console.log('[AutoTest][content] script loaded on', window.location.href.substring(0, 60));

// 全局错误捕获：忽略 Extension context invalidated
window.addEventListener('error', function(e) {
  if (e.message && e.message.indexOf('Extension context invalidated') !== -1) {
    e.preventDefault();
    return false;
  }
});

// 安全发送消息：检查扩展上下文是否有效
function safeSendMessage(msg) {
  try {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.runtime.sendMessage(msg, function() {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  } catch(e) {}
}

// 安全存储读取
function safeStorageGet(keys, cb) {
  try {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.storage.local.get(keys, function(r) {
      if (chrome.runtime.lastError) return;
      cb(r);
    });
  } catch(e) {}
}

// ========== inject.js 注入 ==========
var s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(s);
s.onload = function() { s.remove(); };

// 监听 inject.js 的消息，转发到 background
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'AUTOTEST_API_REQUEST') {
    safeSendMessage({ type: 'SAVE_API', data: event.data.data });
  }
  if (event.data && event.data.type === 'AUTOTEST_TRIGGER_INTERACTION') {
    safeSendMessage({
      type: 'TRIGGER_INTERACTION',
      interactionType: event.data.interactionType,
      selector: event.data.selector,
      pageUrl: event.data.pageUrl,
      timestamp: event.data.timestamp
    });
  }
});

// 页面加载时自动检查录制状态，如果正在录制则启动宏录制
safeStorageGet(['isRecordingMacro'], function(r) {
  if (r.isRecordingMacro) {
    macroRecorder.start();
  }
});

// 监听 background 消息
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log('[AutoTest][content] received msg:', msg.type);
  try {
    if (msg.type === 'START_RECORDING') {
      window.postMessage({ type: 'AUTOTEST_RECORDING_STATE', isRecording: true }, '*');
    } else if (msg.type === 'STOP_RECORDING') {
      window.postMessage({ type: 'AUTOTEST_RECORDING_STATE', isRecording: false }, '*');
    } else if (msg.type === 'BIZ_TRACE_UPDATE') {
      window.postMessage({ type: 'AUTOTEST_BIZ_TRACE_UPDATE', trace: msg.trace }, '*');
    } else if (msg.type === 'START_MACRO_RECORDING') {
      macroRecorder.start();
      sendResponse({ ok: true });
    } else if (msg.type === 'STOP_MACRO_RECORDING') {
      var actions = macroRecorder.stop();
      sendResponse({ actions: actions || [] });
      return true;
    }
    if (msg.type === 'START_MACRO_REPLAY') {
      macroReplayer.start(msg.actions, msg.settings).then(function(result) {
        safeSendMessage({ type: 'MACRO_REPLAY_DONE', result: result });
      });
    }
    if (msg.type === 'STOP_MACRO_REPLAY') {
      macroReplayer.stop();
    }
  } catch(e) {}
});

// ========== 宏录制器 ==========
var macroRecorder = (function() {
  var recording = false;
  var actions = [];
  var ignoreNextInput = false;

  function getSelector(el) {
    if (!el || el === document || el === document.body) return 'body';
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
    if (el.dataset && el.dataset.testid) return '[data-testid="' + el.dataset.testid + '"]';
    if (el.className && typeof el.className === 'string') {
      var classes = el.className.trim().split(/\s+/).filter(function(c) { return c && !c.match(/^(active|show|open|visible|selected|focused|hover)$/); });
      if (classes.length > 0 && classes.length <= 3) {
        var sel = el.tagName.toLowerCase() + '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }
    var parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    var siblings = Array.prototype.filter.call(parent.children, function(c) { return c.tagName === el.tagName; });
    if (siblings.length === 1) return getSelector(parent) + ' > ' + el.tagName.toLowerCase();
    var idx = Array.prototype.indexOf.call(siblings, el) + 1;
    return getSelector(parent) + ' > ' + el.tagName.toLowerCase() + ':nth-of-type(' + idx + ')';
  }

  function getElementInfo(el) {
    if (!el) return null;
    return {
      tag: el.tagName ? el.tagName.toLowerCase() : '',
      selector: getSelector(el),
      text: (el.textContent || '').trim().substring(0, 100),
      type: el.type || '',
      value: el.value || '',
      href: el.href || '',
      placeholder: el.placeholder || ''
    };
  }

  function recordAction(type, el, extra) {
    if (!recording) return;
    var info = getElementInfo(el);
    var action = {
      type: type,
      timestamp: Date.now(),
      url: window.location.href,
      element: info,
      pageUrl: window.location.href
    };
    if (extra) {
      for (var k in extra) { action[k] = extra[k]; }
    }
    actions.push(action);
    console.log('[AutoTest][macroRecord] action:', type, 'total:', actions.length, 'pageUrl:', window.location.href.substring(0, 60));
    safeSendMessage({ type: 'SAVE_MACRO_ACTION', action: action });
  }

  function onClick(e) {
    var el = e.target;
    if (el.tagName === 'A' || el.closest('a')) {
      var link = el.tagName === 'A' ? el : el.closest('a');
      if (link.href && !link.href.startsWith('javascript:')) {
        recordAction('click', el);
      }
    } else {
      recordAction('click', el);
    }
  }

  function onInput(e) {
    var el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      recordAction('input', el, { value: el.value });
    }
  }

  function onChange(e) {
    var el = e.target;
    if (el.tagName === 'SELECT') {
      recordAction('select', el, { value: el.value });
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      recordAction('check', el, { checked: el.checked });
    }
  }

  function onSubmit(e) {
    recordAction('submit', e.target);
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      recordAction('keypress', e.target, { key: 'Enter' });
    }
  }

  function start() {
    if (recording) return;
    recording = true;
    // 不清空 actions，页面跳转后重新注入时保留之前的操作
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('keydown', onKeydown, true);
    console.log('[AutoTest] Macro recording started on', window.location.href.substring(0, 60));
  }

  function stop() {
    recording = false;
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('input', onInput, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('submit', onSubmit, true);
    document.removeEventListener('keydown', onKeydown, true);
    console.log('[AutoTest] Macro recording stopped, actions:', actions.length);
    return actions;
  }

  return { start: start, stop: stop };
})();

// ========== 宏回放器 ==========
var macroReplayer = (function() {
  var stopped = false;

  function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function waitForElement(selector, timeout) {
    timeout = timeout || 10000;
    return new Promise(function(resolve, reject) {
      var el = document.querySelector(selector);
      if (el) { resolve(el); return; }
      var timer = setTimeout(function() { observer.disconnect(); reject(new Error('Element not found: ' + selector)); }, timeout);
      var observer = new MutationObserver(function() {
        var el2 = document.querySelector(selector);
        if (el2) { clearTimeout(timer); observer.disconnect(); resolve(el2); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  function waitForPageLoad(maxWait) {
    maxWait = maxWait || 15000;
    return new Promise(function(resolve) {
      if (document.readyState === 'complete') { resolve(); return; }
      var timer = setTimeout(resolve, maxWait);
      window.addEventListener('load', function() { clearTimeout(timer); resolve(); }, { once: true });
    });
  }

  function simulateClick(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ['mousedown', 'mouseup', 'click'].forEach(function(evtName) {
      el.dispatchEvent(new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window }));
    });
  }

  function simulateInput(el, value) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
                       Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function simulateSelect(el, value) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function executeAction(action, settings) {
    var actionDelay = (settings && settings.macroActionDelay) || 500;

    if (action.type === 'navigate') {
      window.location.href = action.url || action.pageUrl;
      await waitForPageLoad();
      return;
    }

    if (!action.element || !action.element.selector) return;

    try {
      var el = await waitForElement(action.element.selector, 8000);
      await wait(actionDelay);

      switch (action.type) {
        case 'click':
          simulateClick(el);
          break;
        case 'input':
          simulateInput(el, action.value || '');
          break;
        case 'select':
          simulateSelect(el, action.value || '');
          break;
        case 'check':
          if (el.checked !== action.checked) { simulateClick(el); }
          break;
        case 'submit':
          el.submit ? el.submit() : simulateClick(el);
          break;
        case 'keypress':
          el.focus();
          el.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: action.key, bubbles: true }));
          break;
      }
    } catch (err) {
      console.warn('[AutoTest] Action failed:', action.type, action.element.selector, err.message);
    }
  }

  async function start(actions, settings) {
    stopped = false;
    var results = [];

    for (var i = 0; i < actions.length; i++) {
      if (stopped) break;
      var action = actions[i];

      // 如果URL变化了，等待页面加载
      if (action.pageUrl && action.pageUrl !== window.location.href) {
        await waitForPageLoad(15000);
        await wait(500);
      }

      results.push({ index: i, type: action.type, selector: action.element ? action.element.selector : '', status: 'success' });
      await executeAction(action, settings);
      await wait(300);
    }

    return { total: actions.length, executed: results.length, stopped: stopped, results: results };
  }

  function stop() {
    stopped = true;
  }

  return { start: start, stop: stop };
})();
