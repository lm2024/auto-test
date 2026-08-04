// plugin-test/platform-api.js
// 平台请求统一网关：URL 拼装、令牌注入、401 拦截、请求重放、错误归一。不操作 DOM。
// 依赖 window.PlatformAuth（auth.js 先于本文件加载）。
(function () {
  'use strict';

  var loginHandler = null;   // 打开登录面板的回调，由 sidepanel.js 注册
  var loginResolver = null;
  var loginPromise = null;
  var loginPending = false;

  function setLoginHandler(fn) { loginHandler = fn; }
  function resolveLogin(ok) { if (loginResolver) { loginResolver(!!ok); loginResolver = null; } }

  // 等待一次登录；并发 401 复用同一 Promise，保证只弹一次登录框
  function waitForLogin() {
    if (loginPending && loginPromise) return loginPromise;
    loginPending = true;
    loginPromise = new Promise(function (resolve) {
      loginResolver = resolve;
      if (typeof loginHandler === 'function') loginHandler();
      else resolve(false);
    });
    return loginPromise.then(function (ok) {
      loginPending = false; loginPromise = null; loginResolver = null;
      return ok;
    });
  }

  function isValidObj(obj, skewMs) {
    return window.PlatformAuth ? window.PlatformAuth.isValidObj(obj, skewMs) : false;
  }

  // 主入口
  async function apiFetch(path, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var body = options.body != null ? options.body : null;
    var query = options.query || null;
    var auth = options.auth !== false;             // 默认注入令牌
    var retryOn401 = options.retryOn401 !== false; // 默认 401 触发登录 + 重放
    var silent = !!options.silent;

    var store = await new Promise(function (res) {
      chrome.storage.local.get(['settings'], function (r) { res(r.settings || {}); });
    });
    var base = (store.platformUrl || '').replace(/\/+$/, '');
    if (!base) {
      var e1 = new Error('请先在设置中配置后端 API 地址');
      e1.type = 'NO_BASE_URL'; throw e1;
    }

    // 重放请求或静默探测时，无令牌直接判未登录，避免弹窗
    if (auth && !retryOn401 && !isValidObj(await window.PlatformAuth.get())) {
      var e2 = new Error('未登录或登录已过期');
      e2.type = 'UNAUTHORIZED'; throw e2;
    }

    function buildUrl() {
      var u = base + path;
      if (query) {
        var qs = [];
        Object.keys(query).forEach(function (k) {
          var v = query[k];
          if (v != null && v !== '') qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        });
        if (qs.length) u += (u.indexOf('?') >= 0 ? '&' : '?') + qs.join('&');
      }
      return u;
    }

    async function doFetch() {
      var headers = { 'Content-Type': 'application/json' };
      if (auth) {
        var t = await window.PlatformAuth.get();
        if (t && t.token) headers['Authorization'] = 'Bearer ' + t.token;
      }
      var resp, data;
      try {
        resp = await fetch(buildUrl(), {
          method: method,
          headers: headers,
          body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
        });
      } catch (err) {
        var ne = new Error('后端不可达，请检查地址与服务状态');
        ne.type = 'NETWORK'; throw ne;   // 与"未登录"严格区分，不清除令牌
      }
      try { data = await resp.json(); } catch (e) { data = { code: resp.status, message: resp.statusText }; }

      if (resp.status === 401 || (data && data.code === 401)) {
        if (retryOn401 && !silent) {
          var ok = await waitForLogin();
          if (ok) return apiFetch(path, Object.assign({}, options, { retryOn401: false })); // 重放，强制不弹窗防死循环
        }
        var ue = new Error((data && data.message) || '未登录或登录已过期');
        ue.type = 'UNAUTHORIZED';
        ue.reason = data && data.reason;
        throw ue;
      }
      if (!resp.ok || (data && data.code !== undefined && data.code !== 200)) {
        var be = new Error((data && data.message) || ('请求失败 HTTP ' + resp.status));
        be.type = 'BIZ'; be.code = data && data.code; throw be;
      }
      return data;
    }

    return doFetch();
  }

  window.PlatformApi = {
    apiFetch: apiFetch,
    setLoginHandler: setLoginHandler,
    resolveLogin: resolveLogin,
    ensureLogin: waitForLogin,
    isValidObj: isValidObj
  };
})();
