(function() {
  if (window.__AUTOTEST_INJECTED__) return;
  window.__AUTOTEST_INJECTED__ = true;

  var isRecording = false;

  // 监听 recording 状态变更
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'AUTOTEST_RECORDING_STATE') {
      isRecording = event.data.isRecording;
    }
  });

  function save(d) {
    window.postMessage({ type: 'AUTOTEST_API_REQUEST', data: d }, '*');
  }

  function getType(u) {
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)(\?|$)/i.test(u)) return 'static';
    if (/\b(log|track|report|analytics|beacon|collect|stat|monitor)\b/i.test(u)) return 'track';
    return 'api';
  }

  function toAbsUrl(url) {
    try { return new URL(url, location.href).href; } catch(e) { return url; }
  }

  // ========== fetch ==========
  var origFetch = window.fetch;
  window.fetch = function() {
    var rec = isRecording;
    if (!rec) return origFetch.apply(this, arguments);
    var st = Date.now(), input = arguments[0], init = arguments[1] || {};
    var url, method = 'GET', headers = {}, body = null;
    if (typeof input === 'string') { url = toAbsUrl(input); method = init.method || 'GET'; }
    else if (input instanceof Request) { url = toAbsUrl(input.url); method = init.method || input.method || 'GET'; }
    else { url = toAbsUrl(String(input)); method = init.method || 'GET'; }
    if (init.headers) {
      if (init.headers instanceof Headers) init.headers.forEach(function(v, k) { headers[k] = v; });
      else if (typeof init.headers === 'object') Object.assign(headers, init.headers);
    }
    if (init.body != null) {
      if (typeof init.body === 'string') body = init.body;
      else if (init.body instanceof URLSearchParams) body = init.body.toString();
      else if (init.body instanceof FormData) body = '[FormData]';
      else if (init.body instanceof Blob) body = '[Blob:' + init.body.size + ']';
      else try { body = JSON.stringify(init.body); } catch(e) { body = '[Object]'; }
    }
    var m = method.toUpperCase(), u = url, h = Object.assign({}, headers), b = body;
    return origFetch.apply(this, arguments).then(function(r) {
      var dur = Date.now() - st;
      var respH = {};
      r.headers.forEach(function(v, k) { respH[k] = v; });
      var cl = r.clone();
      cl.text().then(function(rt) {
        var respBody = rt;
        try { respBody = JSON.parse(rt); } catch(e) {}
        save({ url: u, method: m, headers: h, body: b, status: r.status, statusText: r.statusText, responseHeaders: respH, response: respBody, duration: dur, timestamp: Date.now(), apiType: getType(u), resourceType: 'fetch_xhr' });
      }).catch(function() {});
      return r;
    }).catch(function(e) {
      save({ url: u, method: m, headers: h, body: b, status: 0, statusText: 'Error', responseHeaders: {}, response: e.message || 'Error', duration: Date.now() - st, timestamp: Date.now(), apiType: getType(u), resourceType: 'fetch_xhr' });
      throw e;
    });
  };

  // ========== XHR ==========
  var XHR = XMLHttpRequest.prototype, oOpen = XHR.open, oSend = XHR.send, oSet = XHR.setRequestHeader;
  XHR.open = function(m, u) { this._at = { method: m.toUpperCase(), url: toAbsUrl(u), headers: {}, body: null, st: Date.now() }; return oOpen.apply(this, arguments); };
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
        if (!isRecording || !self._at) return;
        var t = self._at;
        var respH = {};
        var hdrStr = self.getAllResponseHeaders();
        if (hdrStr) hdrStr.split('\r\n').forEach(function(l) {
          var i = l.indexOf(':');
          if (i > 0) respH[l.substring(0, i).trim()] = l.substring(i + 1).trim();
        });
        var respBody = self.responseText;
        try { respBody = JSON.parse(self.responseText); } catch(e) {}
        save({ url: t.url, method: t.method, headers: Object.assign({}, t.headers), body: t.body, status: self.status, statusText: self.statusText, responseHeaders: respH, response: respBody, duration: Date.now() - t.st, timestamp: Date.now(), apiType: getType(t.url), resourceType: 'fetch_xhr' });
      });
      this.addEventListener('error', function() {
        if (!isRecording || !self._at) return;
        save({ url: self._at.url, method: self._at.method, headers: self._at.headers, body: self._at.body, status: 0, statusText: 'Error', responseHeaders: {}, response: 'Network Error', duration: Date.now() - self._at.st, timestamp: Date.now(), apiType: getType(self._at.url), resourceType: 'fetch_xhr' });
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
    var url = toAbsUrl(form.action || location.href);
    var body = null;
    if (method !== 'GET') {
      var fd = new FormData(form);
      var pairs = [];
      fd.forEach(function(v, k) { pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
      body = pairs.join('&');
    }
    save({ url: url, method: method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, status: 200, statusText: 'Form Submit', responseHeaders: {}, response: null, duration: 0, timestamp: Date.now(), apiType: 'api', resourceType: 'fetch_xhr' });
  }, true);
})();
