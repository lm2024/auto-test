(function() {
  var apis = [];
  var lastApisLength = 0;
  var settings = {};
  var editingIdx = -1;

  function el(id) { return document.getElementById(id); }

  function init() {
    bindAll();
    loadData();
    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area === 'local' && changes.recordedApis) {
        var n = (changes.recordedApis.newValue || []).length;
        if (n !== lastApisLength) { apis = changes.recordedApis.newValue || []; lastApisLength = n; render(); }
      }
    });
  }

  function loadData() {
    chrome.storage.local.get(['isRecording', 'recordedApis', 'settings'], function(r) {
      var rec = r.isRecording || false;
      el('recordBtn').textContent = rec ? '停止录制' : '开始录制';
      el('recordBtn').className = rec ? 'btn btn-recording' : 'btn';
      apis = r.recordedApis || []; lastApisLength = apis.length;
      if (r.settings) settings = r.settings;
      render();
    });
  }

  function bindAll() {
    el('recordBtn').addEventListener('click', function() {
      var rec = this.textContent === '开始录制';
      chrome.storage.local.set({ isRecording: rec });
      chrome.runtime.sendMessage({ type: rec ? 'START_RECORDING' : 'STOP_RECORDING' });
      this.textContent = rec ? '停止录制' : '开始录制';
      this.className = rec ? 'btn btn-recording' : 'btn';
    });
    el('searchInput').addEventListener('input', render);
    el('methodFilter').addEventListener('change', render);
    el('statusFilter').addEventListener('change', render);
    el('autoFilter').addEventListener('change', render);
    el('pushBtn').addEventListener('click', openPush);
    el('exportBtn').addEventListener('click', doExport);
    el('genDocBtn').addEventListener('click', genDoc);
    el('clearBtn').addEventListener('click', function() { apis = []; lastApisLength = 0; chrome.storage.local.set({ recordedApis: [] }); render(); });
    el('detailOverlay').addEventListener('click', function() { closeP('detail'); });
    el('detailClose').addEventListener('click', function() { closeP('detail'); });
    el('settingsOverlay').addEventListener('click', function() { closeP('settings'); });
    el('settingsClose').addEventListener('click', function() { closeP('settings'); });
    el('settingsBtn').addEventListener('click', openSettings);
    el('saveSettingsBtn').addEventListener('click', saveSettings);
    el('pushCancel').addEventListener('click', function() { el('pushDialog').classList.remove('open'); });
    el('pushOk').addEventListener('click', doPush);
    el('pushMode').addEventListener('change', function() { el('pushCodeWrap').style.display = this.value === 'append' ? 'block' : 'none'; });
    el('editCancel').addEventListener('click', function() { el('editDialog').classList.remove('open'); editingIdx = -1; });
    el('editOk').addEventListener('click', function() {
      if (editingIdx < 0) return;
      var v = el('editInput').value.trim();
      if (v) { apis[editingIdx].nodeName = v; chrome.storage.local.set({ recordedApis: apis }); }
      el('editDialog').classList.remove('open'); editingIdx = -1; render();
    });
    el('dbgSend').addEventListener('click', sendDbgRequest);
    // 全选
    el('selectAll').addEventListener('change', function() {
      var checked = this.checked;
      el('apiList').querySelectorAll('.api-check').forEach(function(c) { c.checked = checked; });
      var cnt = checked ? el('apiList').querySelectorAll('.api-check').length : 0;
      el('selText').textContent = '\u5df2\u9009 ' + cnt + ' \u6761';
    });
  }

  // ========== 渲染 ==========
  function render() {
    var search = (el('searchInput').value || '').toLowerCase();
    var method = el('methodFilter').value;
    var st = el('statusFilter').value;
    var af = el('autoFilter').checked;
    var checkedIdxs = {};
    el('apiList').querySelectorAll('.api-check:checked').forEach(function(c) { checkedIdxs[parseInt(c.getAttribute('data-i'))] = true; });

    var filtered = apis.filter(function(a) {
      if (method && a.method !== method) return false;
      if (st === 'success' && a.status > 0 && (a.status < 200 || a.status >= 300)) return false;
      if (st === 'error' && a.status >= 200 && a.status < 400) return false;
      if (search && a.url.toLowerCase().indexOf(search) === -1) return false;
      if (af && (a.apiType === 'static' || a.apiType === 'track')) return false;
      return true;
    });

    el('statsText').textContent = '\u5171 ' + apis.length + ' \u6761\uff0c\u663e\u793a ' + filtered.length + ' \u6761';
    var list = el('apiList'), empty = el('emptyHint');

    if (apis.length === 0) {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(empty); empty.style.display = '';
      el('pushBtn').disabled = true; el('exportBtn').disabled = true; el('genDocBtn').disabled = true; el('clearBtn').disabled = true;
      el('selText').textContent = '\u5df2\u9009 0 \u6761'; return;
    }
    empty.style.display = 'none';
    el('pushBtn').disabled = false; el('exportBtn').disabled = false; el('genDocBtn').disabled = false; el('clearBtn').disabled = false;

    var toRemove = [];
    for (var i = 0; i < list.childNodes.length; i++) { if (list.childNodes[i] !== empty) toRemove.push(list.childNodes[i]); }
    toRemove.forEach(function(n) { list.removeChild(n); });

    for (var k = 0; k < filtered.length; k++) {
      var a = filtered[k], idx = apis.indexOf(a);
      var ok = a.status >= 200 && a.status < 300;
      var nm = a.nodeName || getName(a.url);
      var m = (a.method || 'GET').toUpperCase();
      var chk = checkedIdxs[idx] ? ' checked' : '';
      var div = document.createElement('div');
      div.className = 'api-item'; div.setAttribute('data-i', idx); div.setAttribute('draggable', 'true');
      div.innerHTML = '<input type="checkbox" class="api-check" data-i="' + idx + '"' + chk + '>'
        + '<span class="method-tag m-' + m + '">' + m + '</span>'
        + '<div class="api-info" data-i="' + idx + '"><div class="api-url" title="' + enc(a.url) + '">' + enc(nm) + '</div>'
        + '<div class="api-meta"><span>' + enc(shortUrl(a.url)) + '</span><span>' + (a.duration || 0) + 'ms</span></div></div>'
        + '<span class="api-status ' + (ok ? 'st-ok' : 'st-err') + '">' + (a.status || 'ERR') + '</span>'
        + '<div class="api-acts">'
        + '<button class="act-btn" data-a="debug" data-i="' + idx + '" title="调试">\u{1f527}</button>'
        + '<button class="act-btn" data-a="copy" data-i="' + idx + '" title="复制OpenAPI">\u{1f4cb}</button>'
        + '<button class="act-btn" data-a="edit" data-i="' + idx + '" title="编辑">\u270e</button>'
        + '<button class="act-btn del" data-a="del" data-i="' + idx + '" title="删除">\u2715</button></div>';
      list.appendChild(div);
    }

    list.querySelectorAll('.api-check').forEach(function(c) {
      c.addEventListener('change', function() { el('selText').textContent = '\u5df2\u9009 ' + list.querySelectorAll('.api-check:checked').length + ' \u6761'; });
    });
    list.querySelectorAll('.api-info').forEach(function(info) {
      info.addEventListener('click', function() { showDetail(parseInt(this.getAttribute('data-i'))); });
    });
    list.querySelectorAll('.act-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var i = parseInt(this.getAttribute('data-i')), a = this.getAttribute('data-a');
        if (a === 'edit') { editingIdx = i; el('editInput').value = apis[i].nodeName || getName(apis[i].url); el('editDialog').classList.add('open'); }
        else if (a === 'del') { apis.splice(i, 1); lastApisLength = apis.length; chrome.storage.local.set({ recordedApis: apis }); render(); }
        else if (a === 'debug') { openDebugger(apis[i]); }
        else if (a === 'copy') { copyOpenAPI(apis[i]); }
      });
    });
    var cnt = list.querySelectorAll('.api-check:checked').length;
    el('selText').textContent = '\u5df2\u9009 ' + cnt + ' \u6761';
  }

  // ========== 详情 ==========
  function showDetail(idx) {
    var a = apis[idx]; if (!a) return;
    el('detailTitle').textContent = (a.method || 'GET') + ' ' + getName(a.url);
    el('detailBody').innerHTML =
      '<div class="meta-grid">'
      + '<div><div class="meta-label">\u8282\u70b9\u540d\u79f0</div><div>' + enc(a.nodeName || getName(a.url)) + '</div></div>'
      + '<div><div class="meta-label">\u65b9\u6cd5</div><div>' + (a.method || 'GET') + '</div></div>'
      + '<div><div class="meta-label">\u72b6\u6001\u7801</div><div>' + (a.status || 'N/A') + '</div></div>'
      + '<div><div class="meta-label">\u8017\u65f6</div><div>' + (a.duration || 0) + 'ms</div></div>'
      + '<div style="grid-column:1/3"><div class="meta-label">URL</div><div style="word-break:break-all;font-size:10px">' + enc(a.url) + '</div></div>'
      + '<div><div class="meta-label">\u65f6\u95f4</div><div>' + new Date(a.timestamp).toLocaleString() + '</div></div></div>'
      + sec('\u8bf7\u6c42\u5934', a.headers, 'headers', idx)
      + sec('\u8bf7\u6c42\u4f53', a.body, 'body', idx)
      + sec('\u54cd\u5e94\u5934', a.responseHeaders, 'responseHeaders', idx)
      + sec('\u54cd\u5e94\u4f53', a.response, 'response', idx);
    el('detailBody').querySelectorAll('.cpy-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        var f = this.getAttribute('data-f'), ix = parseInt(this.getAttribute('data-i'));
        var v = apis[ix] ? apis[ix][f] : '';
        if (v && typeof v === 'object') try { v = JSON.stringify(v, null, 2); } catch(e) {}
        navigator.clipboard.writeText(String(v || '')).then(function() { b.textContent = '\u5df2\u590d\u5236'; setTimeout(function() { b.textContent = '\u590d\u5236'; }, 1000); });
      });
    });
    openP('detail');
  }

  function sec(title, data, field, idx) {
    return '<div class="section"><div class="section-hd">' + title + ' <button class="cpy-btn" data-f="' + field + '" data-i="' + idx + '">\u590d\u5236</button></div><pre>' + (fmt(data) || '(\u7a7a)') + '</pre></div>';
  }

  // ========== 调试器 ==========
  function openDebugger(a) {
    el('dbgUrl').value = a.url || '';
    el('dbgMethod').value = a.method || 'GET';
    el('dbgBody').value = a.body ? (typeof a.body === 'string' ? a.body : JSON.stringify(a.body, null, 2)) : '';
    el('dbgHeaders').innerHTML = '';
    var hdrs = a.headers || {};
    Object.keys(hdrs).forEach(function(k) { addDbgHeader(k, hdrs[k]); });
    if (Object.keys(hdrs).length === 0 && ['POST','PUT','PATCH'].indexOf(a.method) >= 0) { addDbgHeader('Content-Type', 'application/json'); }
    el('dbgResponse').classList.remove('show');
    el('dbgDialog').classList.add('open');
  }

  window.addDbgHeader = function(k, v) {
    var row = document.createElement('div');
    row.className = 'dbg-kv-row';
    row.innerHTML = '<input placeholder="Header名" value="' + enc(k || '') + '"><input placeholder="Header值" value="' + enc(v || '') + '"><button onclick="this.parentElement.remove()">\u00d7</button>';
    el('dbgHeaders').appendChild(row);
  };

  window.sendDbgRequest = async function() {
    var url = el('dbgUrl').value.trim();
    if (!url) { alert('\u8bf7\u8f93\u5165\u8bf7\u6c42\u5730\u5740'); return; }
    el('dbgSend').disabled = true; el('dbgSend').textContent = '\u23f3 \u53d1\u9001\u4e2d...';
    try {
      var hdrs = {};
      el('dbgHeaders').querySelectorAll('.dbg-kv-row').forEach(function(r) {
        var inputs = r.querySelectorAll('input');
        if (inputs[0].value.trim()) hdrs[inputs[0].value.trim()] = inputs[1].value.trim();
      });
      var opts = { method: el('dbgMethod').value, headers: hdrs };
      if (['POST','PUT','PATCH'].indexOf(opts.method) >= 0) { var b = el('dbgBody').value.trim(); if (b) opts.body = b; }
      var st = Date.now(), resp = await fetch(url, opts), dur = Date.now() - st;
      var ct = resp.headers.get('content-type'), rbody;
      if (ct && ct.indexOf('json') >= 0) { var t = await resp.text(); try { rbody = JSON.parse(t); } catch(e) { rbody = t; } }
      else rbody = await resp.text();
      el('dbgStatus').textContent = resp.status + ' ' + resp.statusText;
      el('dbgStatus').className = 'dbg-status ' + (resp.ok ? 'ok' : 'err');
      el('dbgDuration').textContent = dur + 'ms';
      el('dbgResponseBody').textContent = typeof rbody === 'string' ? rbody : JSON.stringify(rbody, null, 2);
      el('dbgResponse').classList.add('show');
      el('dbgSend').textContent = '\u2714 \u6210\u529f';
    } catch(e) {
      el('dbgStatus').textContent = '\u274c \u8bf7\u6c42\u5931\u8d25'; el('dbgStatus').className = 'dbg-status err';
      el('dbgResponseBody').textContent = e.message; el('dbgResponse').classList.add('show');
      el('dbgSend').textContent = '\u274c \u5931\u8d25';
    }
    setTimeout(function() { el('dbgSend').textContent = '\u{1f680} \u53d1\u9001\u8bf7\u6c42'; el('dbgSend').disabled = false; }, 2000);
  };

  // ========== OpenAPI 复制 ==========
  function copyOpenAPI(a) {
    var spec = buildOpenAPI(a);
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2)).then(function() { alert('OpenAPI JSON \u5df2\u590d\u5236\u5230\u526a\u8d34\u677f'); });
  }

  function buildOpenAPI(a) {
    var url;
    try { url = new URL(a.url); } catch(e) { url = { origin: '', pathname: a.url }; }
    var qp = {};
    if (url.searchParams) url.searchParams.forEach(function(v, k) { qp[k] = { schema: { type: 'string' }, example: v }; });
    var reqSchema = null;
    if (a.body) { try { var d = typeof a.body === 'string' ? JSON.parse(a.body) : a.body; reqSchema = inferSchema(d); } catch(e) {} }
    var respSchema = null;
    if (a.response) { try { var d2 = typeof a.response === 'string' ? JSON.parse(a.response) : a.response; respSchema = inferSchema(d2); } catch(e) {} }
    var method = (a.method || 'GET').toLowerCase();
    var pathObj = {};
    pathObj[method] = { summary: (a.method || 'GET') + ' ' + url.pathname, parameters: [], responses: {} };
    Object.keys(qp).forEach(function(k) { pathObj[method].parameters.push({ name: k, in: 'query', ...qp[k] }); });
    if (reqSchema) pathObj[method].requestBody = { required: true, content: { 'application/json': { schema: reqSchema, example: a.body } } };
    pathObj[method].responses[String(a.status || 200)] = { description: a.statusText || 'OK', content: { 'application/json': { schema: respSchema || { type: 'object' }, example: a.response } } };
    return { openapi: '3.0.0', info: { title: 'API Documentation', version: '1.0.0', description: '\u81ea\u52a8\u5f55\u5236\u751f\u6210' }, servers: [{ url: url.origin }], paths: {} };
  }

  function inferSchema(data) {
    if (data === null) return { type: 'null' };
    var type = Array.isArray(data) ? 'array' : typeof data;
    if (type === 'array') return { type: 'array', items: data.length > 0 ? inferSchema(data[0]) : { type: 'object' } };
    if (type === 'object') { var props = {}, req = []; Object.keys(data).forEach(function(k) { props[k] = inferSchema(data[k]); if (data[k] != null) req.push(k); }); return { type: 'object', properties: props, required: req.length > 0 ? req : undefined }; }
    if (type === 'number') return { type: Number.isInteger(data) ? 'integer' : 'number' };
    if (type === 'boolean') return { type: 'boolean' };
    return { type: 'string' };
  }

  // ========== 生成文档 ==========
  function genDoc() {
    if (apis.length === 0) { alert('\u6ca1\u6709\u8bf7\u6c42\u8bb0\u5f55'); return; }
    var grouped = {};
    apis.forEach(function(a) {
      try {
        var url = new URL(a.url), path = url.pathname, method = a.method || 'GET';
        var key = method + ' ' + path;
        if (!grouped[key]) grouped[key] = { method: method, path: path, baseUrl: url.origin, examples: [] };
        grouped[key].examples.push(a);
      } catch(e) {}
    });
    var docs = Object.values(grouped);
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>API\u6587\u6863</title><style>'
      + 'body{font-family:sans-serif;max-width:1200px;margin:0 auto;padding:20px;background:#f5f5f5}'
      + '.h{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;border-radius:12px;text-align:center;margin-bottom:20px}'
      + '.card{background:#fff;border-radius:10px;margin-bottom:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}'
      + '.card-h{padding:16px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px}'
      + '.m{padding:4px 10px;border-radius:4px;color:#fff;font-weight:700;font-size:12px}'
      + '.m-GET{background:#67c23a}.m-POST{background:#409eff}.m-PUT{background:#e6a23c}.m-DELETE{background:#f56c6c}'
      + '.card-b{padding:16px}'
      + 'pre{background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px}'
      + '</style></head><body>'
      + '<div class="h"><h1>\u{1f4da} API\u63a5\u53e3\u6587\u6863</h1><p>\u751f\u6210\u65f6\u95f4: ' + new Date().toLocaleString() + ' | \u63a5\u53e3\u6570\u91cf: ' + docs.length + '</p></div>';
    docs.forEach(function(d) {
      html += '<div class="card"><div class="card-h"><span class="m m-' + d.method + '">' + d.method + '</span><strong>' + d.path + '</strong><span style="color:#999;font-size:12px;margin-left:auto">' + d.baseUrl + '</span></div><div class="card-b">';
      d.examples.forEach(function(ex) {
        html += '<div style="margin-bottom:10px">';
        if (ex.body) html += '<div style="margin-bottom:6px"><strong>\u8bf7\u6c42\u4f53:</strong><pre>' + esc(JSON.stringify(typeof ex.body === 'string' ? ex.body : ex.body, null, 2)) + '</pre></div>';
        if (ex.response) html += '<div style="margin-bottom:6px"><strong>\u54cd\u5e94\u4f53:</strong><pre>' + esc(JSON.stringify(ex.response, null, 2)) + '</pre></div>';
        if (ex.headers) html += '<div><strong>\u54cd\u5e94\u5934:</strong><pre>' + esc(JSON.stringify(ex.responseHeaders || ex.headers, null, 2)) + '</pre></div>';
        html += '</div>';
      });
      html += '</div></div>';
    });
    html += '</body></html>';
    var w = window.open('', '_blank'); w.document.write(html); w.document.close();
  }

  // ========== 设置 ==========
  function openSettings() {
    el('cfgUrl').value = settings.platformUrl || '';
    el('cfgFrontendUrl').value = settings.frontendUrl || '';
    el('cfgKw').value = settings.ignoreKeywords || '';
    el('cfgDomains').value = settings.ignoreDomains || '';
    el('cfgMode').value = settings.idMode || 'AUTO_INCREMENT';
    el('cfgStep').value = settings.idStep || 1;
    openP('settings');
  }
  function saveSettings() {
    settings.platformUrl = el('cfgUrl').value.trim();
    settings.frontendUrl = el('cfgFrontendUrl').value.trim();
    settings.ignoreKeywords = el('cfgKw').value;
    settings.ignoreDomains = el('cfgDomains').value;
    settings.idMode = el('cfgMode').value;
    settings.idStep = parseInt(el('cfgStep').value) || 1;
    chrome.storage.local.set({ settings: settings });
    alert('\u8bbe\u7f6e\u5df2\u4fdd\u5b58'); closeP('settings'); render();
  }

  // ========== 推送 ==========
  function openPush() {
    var c = getChecked();
    if (!c.length) { alert('\u8bf7\u52fe\u9009\u63a5\u53e3'); return; }
    el('pushName').value = '\u5f55\u5236\u63a5\u53e3-' + new Date().toLocaleDateString();
    el('pushDialog').classList.add('open');
  }
  function doPush() {
    var name = el('pushName').value.trim();
    if (!name) { alert('\u8bf7\u8f93\u5165\u94fe\u8def\u540d\u79f0'); return; }
    var mode = el('pushMode').value, code = el('pushCode').value.trim(), list = getChecked();
    if (mode === 'append' && !code) { alert('\u8bf7\u8f93\u5165\u94fe\u8def\u7f16\u7801'); return; }
    var ifList = list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: typeof a.response === 'string' ? a.response : JSON.stringify(a.response || ''), sort: i + 1, parallelGroup: '' }; });
    var url = (settings.platformUrl || 'http://localhost:8080') + '/api/plugin/chain/' + (mode === 'create' ? 'create' : 'append');
    var body = mode === 'create' ? JSON.stringify({ chainName: name, interfaceList: ifList }) : JSON.stringify({ chainCode: code, interfaceList: ifList });
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.code === 200) {
        var code = d.data.chainCode || code;
        el('pushDialog').classList.remove('open');
        // 跳转到平台查看
        var platformUrl = (settings.frontendUrl || 'http://localhost:3000') + '/chain/edit/' + code;
        if (confirm('\u63a8\u9001\u6210\u529f\uff01\u94fe\u8def\u7f16\u7801: ' + code + '\n\n\u662f\u5426\u8df3\u8f6c\u5230\u5e73\u53f0\u67e5\u770b\uff1f')) {
          window.open(platformUrl, '_blank');
        }
      }
      else alert('\u5931\u8d25: ' + (d.message || ''));
    }).catch(function(e) { alert('\u5931\u8d25: ' + e.message); });
  }

  // ========== 导出 ==========
  function doExport() {
    var list = getChecked();
    if (!list.length) { alert('\u8bf7\u52fe\u9009\u63a5\u53e3'); return; }
    var data = { chainName: '\u5f55\u5236\u63a5\u53e3-' + new Date().toLocaleDateString(), interfaceList: list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: typeof a.response === 'string' ? a.response : JSON.stringify(a.response || ''), sort: i + 1, parallelGroup: '' }; }) };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var u = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = u; a.download = 'apis-' + Date.now() + '.json'; a.click(); URL.revokeObjectURL(u);
  }

  // ========== 工具 ==========
  function openP(n) { el(n + 'Overlay').classList.add('open'); el(n + 'Panel').classList.add('open'); }
  function closeP(n) { el(n + 'Overlay').classList.remove('open'); el(n + 'Panel').classList.remove('open'); }
  function getChecked() { var r = []; el('apiList').querySelectorAll('.api-check:checked').forEach(function(c) { var i = parseInt(c.getAttribute('data-i')); if (apis[i]) r.push(apis[i]); }); return r; }
  function getName(u) { try { var p = new URL(u).pathname.split('/').filter(Boolean); return p[p.length - 1] || 'index'; } catch(e) { return (u || '').split('/').pop() || '?'; } }
  function shortUrl(u) { try { var x = new URL(u); return x.hostname + x.pathname.substring(0, 25) + (x.pathname.length > 25 ? '...' : ''); } catch(e) { return (u || '').substring(0, 35); } }
  function enc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(d) { if (!d) return ''; if (typeof d === 'string') try { return JSON.stringify(JSON.parse(d), null, 2); } catch(e) { return d; } return JSON.stringify(d, null, 2); }

  init();
})();
