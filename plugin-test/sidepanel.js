(function() {
  var apis = [];
  var lastApisLength = 0;
  var settings = {};
  var editingIdx = -1;

  function el(id) { return document.getElementById(id); }
  function narrow() { return window.innerWidth <= 360; }

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
      var btn = el('recordBtn');
      var label = narrow() ? (rec ? '停止' : '录制') : (rec ? '停止录制' : '开始录制');
      btn.textContent = label;
      btn.className = rec ? 'btn btn-stop' : 'btn';
      apis = r.recordedApis || []; lastApisLength = apis.length;
      if (r.settings) settings = r.settings;
      render();
    });
  }

  function bindAll() {
    el('recordBtn').addEventListener('click', function() {
      var isNarrow = narrow();
      var isRec = isNarrow ? (this.textContent === '录制') : (this.textContent === '开始录制');
      chrome.storage.local.set({ isRecording: isRec });
      chrome.runtime.sendMessage({ type: isRec ? 'START_RECORDING' : 'STOP_RECORDING' });
      var label = isNarrow ? (isRec ? '停止' : '录制') : (isRec ? '停止录制' : '开始录制');
      this.textContent = label;
      this.className = isRec ? 'btn btn-stop' : 'btn';
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
      el('selText').textContent = '已选 ' + cnt + ' 条';
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

    var statsLabel = narrow() ? (apis.length + '条 显' + filtered.length) : ('共 ' + apis.length + ' 条，显示 ' + filtered.length + ' 条');
    el('statsText').textContent = statsLabel;
    var list = el('apiList'), empty = el('emptyHint');

    if (apis.length === 0) {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(empty); empty.style.display = '';
      el('pushBtn').disabled = true; el('exportBtn').disabled = true; el('genDocBtn').disabled = true; el('clearBtn').disabled = true;
      el('selText').textContent = '已选 0'; return;
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
        + '<span class="method-badge m-' + m + '">' + m + '</span>'
        + '<div class="api-info" data-i="' + idx + '"><div class="api-name" title="' + enc(a.url) + '">' + enc(nm) + '</div>'
        + '<div class="api-meta"><span>' + enc(shortUrl(a.url)) + '</span><span>' + (a.duration || 0) + 'ms</span></div></div>'
        + '<span class="status-badge ' + (ok ? 'st-ok' : 'st-err') + '">' + (a.status || 'ERR') + '</span>'
        + '<div class="api-acts">'
        + '<button class="act-btn" data-a="debug" data-i="' + idx + '" title="调试"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>'
        + '<button class="act-btn" data-a="copy" data-i="' + idx + '" title="复制OpenAPI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
        + '<button class="act-btn" data-a="edit" data-i="' + idx + '" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        + '<button class="act-btn del" data-a="del" data-i="' + idx + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
      list.appendChild(div);
    }

    list.querySelectorAll('.api-check').forEach(function(c) {
      c.addEventListener('change', function() { el('selText').textContent = '已选 ' + list.querySelectorAll('.api-check:checked').length + ' 条'; });
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
    el('selText').textContent = '已选 ' + cnt + ' 条';
  }

  // ========== 详情 ==========
  function showDetail(idx) {
    var a = apis[idx]; if (!a) return;
    el('detailTitle').textContent = (a.method || 'GET') + ' ' + getName(a.url);
    var ok = a.status >= 200 && a.status < 300;
    el('detailBody').innerHTML =
      '<div class="meta-grid">'
      + '<div><div class="meta-label">节点名称</div><div class="meta-value">' + enc(a.nodeName || getName(a.url)) + '</div></div>'
      + '<div><div class="meta-label">方法</div><div class="meta-value">' + (a.method || 'GET') + '</div></div>'
      + '<div><div class="meta-label">状态码</div><div class="meta-value"><span class="status-badge ' + (ok ? 'st-ok' : 'st-err') + '">' + (a.status || 'N/A') + '</span></div></div>'
      + '<div><div class="meta-label">耗时</div><div class="meta-value">' + (a.duration || 0) + 'ms</div></div>'
      + '<div class="meta-full"><div class="meta-label">URL</div><div class="meta-value" style="font-size:10px">' + enc(a.url) + '</div></div>'
      + '<div><div class="meta-label">时间</div><div class="meta-value">' + new Date(a.timestamp).toLocaleString() + '</div></div></div>'
      + sec('请求头', a.headers, 'headers', idx)
      + sec('请求体', a.body, 'body', idx)
      + sec('响应头', a.responseHeaders, 'responseHeaders', idx)
      + sec('响应体', a.response, 'response', idx);
    el('detailBody').querySelectorAll('.cpy-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        var f = this.getAttribute('data-f'), ix = parseInt(this.getAttribute('data-i'));
        var v = apis[ix] ? apis[ix][f] : '';
        if (v && typeof v === 'object') try { v = JSON.stringify(v, null, 2); } catch(e) {}
        navigator.clipboard.writeText(String(v || '')).then(function() { b.textContent = '已复制'; setTimeout(function() { b.textContent = '复制'; }, 1000); });
      });
    });
    openP('detail');
  }

  function sec(title, data, field, idx) {
    return '<div class="detail-section"><div class="detail-section-hd">' + title + ' <button class="cpy-btn" data-f="' + field + '" data-i="' + idx + '">复制</button></div><pre>' + (fmt(data) || '(空)') + '</pre></div>';
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
    row.innerHTML = '<input placeholder="Header名" value="' + enc(k || '') + '"><input placeholder="Header值" value="' + enc(v || '') + '"><button class="dbg-kv-btn" onclick="this.parentElement.remove()">×</button>';
    el('dbgHeaders').appendChild(row);
  };

  window.sendDbgRequest = async function() {
    var url = el('dbgUrl').value.trim();
    if (!url) { alert('请输入请求地址'); return; }
    el('dbgSend').disabled = true; el('dbgSend').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> 发送中...';
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
      el('dbgSend').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 成功';
    } catch(e) {
      el('dbgStatus').textContent = '请求失败'; el('dbgStatus').className = 'dbg-status err';
      el('dbgResponseBody').textContent = e.message; el('dbgResponse').classList.add('show');
      el('dbgSend').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> 失败';
    }
    setTimeout(function() { el('dbgSend').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> 发送请求'; el('dbgSend').disabled = false; }, 2000);
  };

  // ========== OpenAPI 复制 ==========
  function copyOpenAPI(a) {
    var spec = buildOpenAPI(a);
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2)).then(function() { alert('OpenAPI JSON 已复制到剪贴板'); });
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
    return { openapi: '3.0.0', info: { title: 'API Documentation', version: '1.0.0', description: '自动录制生成' }, servers: [{ url: url.origin }], paths: {} };
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
    var selected = getChecked();
    if (selected.length === 0) { alert('请先选择要生成文档的接口'); return; }
    var grouped = {};
    selected.forEach(function(a) {
      try {
        var url = new URL(a.url), path = url.pathname, method = a.method || 'GET';
        var key = method + ' ' + path;
        if (!grouped[key]) grouped[key] = { method: method, path: path, baseUrl: url.origin, examples: [] };
        grouped[key].examples.push(a);
      } catch(e) {}
    });
    var docs = Object.values(grouped);
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>API文档</title><style>'
      + 'body{font-family:"Noto Sans SC",sans-serif;max-width:1200px;margin:0 auto;padding:20px;background:#F8FAFC}'
      + '.h{background:linear-gradient(135deg,#1E293B,#334155);color:#fff;padding:30px;border-radius:12px;text-align:center;margin-bottom:20px}'
      + '.card{background:#fff;border-radius:10px;margin-bottom:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}'
      + '.card-h{padding:16px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px}'
      + '.m{padding:4px 10px;border-radius:4px;color:#fff;font-weight:700;font-size:12px}'
      + '.m-GET{background:#16A34A}.m-POST{background:#2563EB}.m-PUT{background:#D97706}.m-DELETE{background:#DC2626}'
      + '.card-b{padding:16px}'
      + 'pre{background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px}'
      + '</style></head><body>'
      + '<div class="h"><h1>API接口文档</h1><p>生成时间: ' + new Date().toLocaleString() + ' | 接口数量: ' + docs.length + '</p></div>';
    docs.forEach(function(d) {
      html += '<div class="card"><div class="card-h"><span class="m m-' + d.method + '">' + d.method + '</span><strong>' + d.path + '</strong><span style="color:#999;font-size:12px;margin-left:auto">' + d.baseUrl + '</span></div><div class="card-b">';
      d.examples.forEach(function(ex) {
        html += '<div style="margin-bottom:10px">';
        if (ex.body) html += '<div style="margin-bottom:6px"><strong>请求体:</strong><pre>' + esc(JSON.stringify(typeof ex.body === 'string' ? ex.body : ex.body, null, 2)) + '</pre></div>';
        if (ex.response) html += '<div style="margin-bottom:6px"><strong>响应体:</strong><pre>' + esc(JSON.stringify(ex.response, null, 2)) + '</pre></div>';
        if (ex.headers) html += '<div><strong>响应头:</strong><pre>' + esc(JSON.stringify(ex.responseHeaders || ex.headers, null, 2)) + '</pre></div>';
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
    alert('设置已保存'); closeP('settings'); render();
  }

  // ========== 推送 ==========
  function openPush() {
    var c = getChecked();
    if (!c.length) { alert('请勾选接口'); return; }
    el('pushName').value = '录制接口-' + new Date().toLocaleDateString();
    el('pushDialog').classList.add('open');
  }
  function doPush() {
    var name = el('pushName').value.trim();
    if (!name) { alert('请输入链路名称'); return; }
    var mode = el('pushMode').value, code = el('pushCode').value.trim(), list = getChecked();
    if (mode === 'append' && !code) { alert('请输入链路编码'); return; }
    var ifList = list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: typeof a.response === 'string' ? a.response : JSON.stringify(a.response || ''), sort: i + 1, parallelGroup: '' }; });
    var url = (settings.platformUrl || 'http://localhost:8080') + '/api/plugin/chain/' + (mode === 'create' ? 'create' : 'append');
    var body = mode === 'create' ? JSON.stringify({ chainName: name, interfaceList: ifList }) : JSON.stringify({ chainCode: code, interfaceList: ifList });
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.code === 200) {
        var code = d.data.chainCode || code;
        el('pushDialog').classList.remove('open');
        var platformUrl = (settings.frontendUrl || 'http://localhost:3000') + '/chain/edit/' + code;
        if (confirm('推送成功！链路编码: ' + code + '\n\n是否跳转到平台查看？')) {
          window.open(platformUrl, '_blank');
        }
      }
      else alert('失败: ' + (d.message || ''));
    }).catch(function(e) { alert('失败: ' + e.message); });
  }

  // ========== 导出 ==========
  function doExport() {
    var list = getChecked();
    if (!list.length) { alert('请勾选接口'); return; }
    var data = { chainName: '录制接口-' + new Date().toLocaleDateString(), interfaceList: list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: typeof a.response === 'string' ? a.response : JSON.stringify(a.response || ''), sort: i + 1, parallelGroup: '' }; }) };
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
