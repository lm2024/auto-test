// plugin-test/auth.js
// 平台登录态：令牌仓库 + JWT exp 解析 + 状态机。不发网络请求，不操作 DOM。
// 环境防呆(MISMATCH)：由 sidepanel.js 在保存设置时比对 boundUrl 实现。
(function () {
  'use strict';
  var STORAGE_KEY = 'platformAuth';
  var listeners = [];

  // 解析 JWT payload.exp（秒）→ 毫秒。仅本地预检，只读不验签，权威校验始终在后端。
  function parseExp(jwt) {
    if (!jwt || typeof jwt !== 'string') return null;
    try {
      var parts = jwt.split('.');
      if (parts.length !== 3) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = decodeURIComponent(escape(window.atob(b64)));
      var payload = JSON.parse(json);
      return payload.exp ? payload.exp * 1000 : null;
    } catch (e) { return null; }
  }

  function get() {
    return new Promise(function (resolve) {
      chrome.storage.local.get([STORAGE_KEY], function (r) { resolve(r[STORAGE_KEY] || null); });
    });
  }

  function set(authObj) {
    return new Promise(function (resolve) {
      chrome.storage.local.set({ platformAuth: authObj }, function () {
        notify(authObj); resolve(authObj);
      });
    });
  }

  function clear() {
    return new Promise(function (resolve) {
      chrome.storage.local.remove([STORAGE_KEY], function () {
        notify(null); resolve();
      });
    });
  }

  // 本地判定：存在且距 exp 还有 > skewMs（默认 5 分钟）
  function isValidObj(obj, skewMs) {
    skewMs = skewMs == null ? 300000 : skewMs;
    if (!obj || !obj.token) return false;
    var exp = obj.exp != null ? obj.exp : parseExp(obj.token);
    if (!exp) return false;
    return exp - Date.now() > skewMs;
  }

  async function getState(baseUrl) {
    var obj = await get();
    if (!obj || !obj.token) return 'ANONYMOUS';
    if (baseUrl && obj.boundUrl && obj.boundUrl !== baseUrl) return 'MISMATCH';
    if (!isValidObj(obj)) return 'EXPIRED';
    return 'AUTHED';
  }

  function onChange(cb) { if (typeof cb === 'function') listeners.push(cb); }

  function notify(obj) { listeners.forEach(function (cb) { try { cb(obj); } catch (e) {} }); }

  // 跨实例 / 跨标签页登录态同步
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[STORAGE_KEY]) notify(changes[STORAGE_KEY].newValue || null);
    });
  }

  window.PlatformAuth = {
    parseExp: parseExp,
    get: get,
    set: set,
    clear: clear,
    isValidObj: isValidObj,
    getState: getState,
    onChange: onChange
  };
})();
