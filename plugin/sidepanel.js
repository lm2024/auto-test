(function() {
  var apis = [];
  var settings = {};
  var editingIdx = -1;

  function el(id) { return document.getElementById(id); }

  function init() {
    bindAll();
    loadData();
    setInterval(loadData, 500);
  }

  function loadData() {
    chrome.storage.local.get(['isRecording', 'recordedApis', 'settings'], function(r) {
      var wasRecording = el('recordBtn').textContent === '停止录制';
      var nowRecording = r.isRecording || false;
      if (wasRecording !== nowRecording) {
        el('recordBtn').textContent = nowRecording ? '停止录制' : '开始录制';
        el('recordBtn').className = nowRecording ? 'btn btn-recording' : 'btn';
      }
      apis = r.recordedApis || [];
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
    el('clearBtn').addEventListener('click', function() { apis = []; chrome.storage.local.set({ recordedApis: [] }); render(); });
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
  }

  function render() {
    var search = (el('searchInput').value || '').toLowerCase();
    var method = el('methodFilter').value;
    var st = el('statusFilter').value;
    var af = el('autoFilter').checked;

    var filtered = apis.filter(function(a) {
      if (method && a.method !== method) return false;
      if (st === 'success' && a.status > 0 && (a.status < 200 || a.status >= 300)) return false;
      if (st === 'error' && a.status >= 200 && a.status < 400) return false;
      if (search && a.url.toLowerCase().indexOf(search) === -1) return false;
      if (af && (a.apiType === 'static' || a.apiType === 'track')) return false;
      return true;
    });

    el('statsText').textContent = '\u5171 ' + apis.length + ' \u6761\uff0c\u663e\u793a ' + filtered.length + ' \u6761';

    var list = el('apiList');
    var empty = el('emptyHint');

    if (apis.length === 0) {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(empty);
      empty.style.display = '';
      el('pushBtn').disabled = true;
      el('exportBtn').disabled = true;
      el('clearBtn').disabled = true;
      el('selText').textContent = '\u5df2\u9009 0 \u6761';
      return;
    }

    empty.style.display = 'none';
    el('pushBtn').disabled = false;
    el('exportBtn').disabled = false;
    el('clearBtn').disabled = false;

    // 清空列表（保留 empty）
    var toRemove = [];
    for (var i = 0; i < list.childNodes.length; i++) {
      if (list.childNodes[i] !== empty) toRemove.push(list.childNodes[i]);
    }
    toRemove.forEach(function(n) { list.removeChild(n); });

    // 添加新项
    for (var k = 0; k < filtered.length; k++) {
      var a = filtered[k];
      var idx = apis.indexOf(a);
      var ok = a.status >= 200 && a.status < 300;
      var nm = a.nodeName || getName(a.url);
      var m = (a.method || 'GET').toUpperCase();

      var div = document.createElement('div');
      div.className = 'api-item';
      div.setAttribute('data-i', idx);
      div.setAttribute('draggable', 'true');

      div.innerHTML = '<input type="checkbox" class="api-check" data-i="' + idx + '">'
        + '<span class="method-tag m-' + m + '">' + m + '</span>'
        + '<div class="api-info" data-i="' + idx + '">'
        + '<div class="api-url" title="' + enc(a.url) + '">' + enc(nm) + '</div>'
        + '<div class="api-meta"><span>' + enc(shortUrl(a.url)) + '</span><span>' + (a.duration || 0) + 'ms</span></div></div>'
        + '<span class="api-status ' + (ok ? 'st-ok' : 'st-err') + '">' + (a.status || 'ERR') + '</span>'
        + '<div class="api-acts">'
        + '<button class="act-btn" data-a="edit" data-i="' + idx + '">\u270E</button>'
        + '<button class="act-btn del" data-a="del" data-i="' + idx + '">\u2715</button></div>';

      list.appendChild(div);
    }

    // 绑定事件
    list.querySelectorAll('.api-check').forEach(function(c) {
      c.addEventListener('change', function() { el('selText').textContent = '\u5df2\u9009 ' + list.querySelectorAll('.api-check:checked').length + ' \u6761'; });
    });
    list.querySelectorAll('.api-info').forEach(function(info) {
      info.addEventListener('click', function() { showDetail(parseInt(this.getAttribute('data-i'))); });
    });
    list.querySelectorAll('.act-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var i = parseInt(this.getAttribute('data-i'));
        if (this.getAttribute('data-a') === 'edit') {
          editingIdx = i;
          el('editInput').value = apis[i].nodeName || getName(apis[i].url);
          el('editDialog').classList.add('open');
        } else {
          apis.splice(i, 1);
          chrome.storage.local.set({ recordedApis: apis });
          render();
        }
      });
    });
  }

  function showDetail(idx) {
    var a = apis[idx]; if (!a) return;
    var nm = a.nodeName || getName(a.url);
    el('detailBody').innerHTML =
      '<div class="meta-grid">'
      + '<div><div class="meta-label">\u8282\u70b9\u540d\u79f0</div><div>' + enc(nm) + '</div></div>'
      + '<div><div class="meta-label">\u65b9\u6cd5</div><div>' + (a.method || 'GET') + '</div></div>'
      + '<div><div class="meta-label">\u72b6\u6001\u7801</div><div>' + (a.status || 'N/A') + '</div></div>'
      + '<div><div class="meta-label">\u8017\u65f6</div><div>' + (a.duration || 0) + 'ms</div></div>'
      + '<div style="grid-column:1/3"><div class="meta-label">URL</div><div style="word-break:break-all;font-size:11px">' + enc(a.url) + '</div></div>'
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
        var t = this;
        navigator.clipboard.writeText(String(v || '')).then(function() { t.textContent = '\u5df2\u590d\u5236'; setTimeout(function() { t.textContent = '\u590d\u5236'; }, 1000); });
      });
    });
    openP('detail');
  }

  function sec(title, data, field, idx) {
    return '<div class="section"><div class="section-hd">' + title + ' <button class="cpy-btn" data-f="' + field + '" data-i="' + idx + '">\u590d\u5236</button></div><pre>' + (fmt(data) || '(\u7a7a)') + '</pre></div>';
  }

  function openSettings() {
    el('cfgUrl').value = settings.platformUrl || '';
    el('cfgKw').value = settings.ignoreKeywords || '';
    el('cfgDomains').value = settings.ignoreDomains || '';
    el('cfgMode').value = settings.idMode || 'AUTO_INCREMENT';
    el('cfgStep').value = settings.idStep || 1;
    openP('settings');
  }

  function saveSettings() {
    settings.platformUrl = el('cfgUrl').value.trim();
    settings.ignoreKeywords = el('cfgKw').value;
    settings.ignoreDomains = el('cfgDomains').value;
    settings.idMode = el('cfgMode').value;
    settings.idStep = parseInt(el('cfgStep').value) || 1;
    chrome.storage.local.set({ settings: settings });
    alert('\u8bbe\u7f6e\u5df2\u4fdd\u5b58');
    closeP('settings'); render();
  }

  function openPush() {
    var c = getChecked();
    if (!c.length) { alert('\u8bf7\u52fe\u9009\u63a5\u53e3'); return; }
    el('pushName').value = '\u5f55\u5236\u63a5\u53e3-' + new Date().toLocaleDateString();
    el('pushDialog').classList.add('open');
  }

  function doPush() {
    var name = el('pushName').value.trim();
    if (!name) { alert('\u8bf7\u8f93\u5165\u94fe\u8def\u540d\u79f0'); return; }
    var mode = el('pushMode').value;
    var code = el('pushCode').value.trim();
    var list = getChecked();
    if (mode === 'append' && !code) { alert('\u8bf7\u8f93\u5165\u94fe\u8def\u7f16\u7801'); return; }
    var ifList = list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: a.response || '', sort: i + 1, parallelGroup: '' }; });
    var url = mode === 'create' ? (settings.platformUrl || 'http://localhost:8080') + '/api/plugin/chain/create' : (settings.platformUrl || 'http://localhost:8080') + '/api/plugin/chain/append';
    var body = mode === 'create' ? JSON.stringify({ chainName: name, interfaceList: ifList }) : JSON.stringify({ chainCode: code, interfaceList: ifList });
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.code === 200) { alert('\u63a8\u9001\u6210\u529f\uff01\u94fe\u8def\u7f16\u7801: ' + (d.data.chainCode || code)); el('pushDialog').classList.remove('open'); }
      else alert('\u5931\u8d25: ' + (d.message || ''));
    }).catch(function(e) { alert('\u5931\u8d25: ' + e.message); });
  }

  function doExport() {
    var list = getChecked();
    if (!list.length) { alert('\u8bf7\u52fe\u9009\u63a5\u53e3'); return; }
    var data = { chainName: '\u5f55\u5236\u63a5\u53e3-' + new Date().toLocaleDateString(), interfaceList: list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: a.response || '', sort: i + 1, parallelGroup: '' }; }) };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = u; a.download = 'apis-' + Date.now() + '.json'; a.click();
    URL.revokeObjectURL(u);
  }

  function openP(n) { el(n + 'Overlay').classList.add('open'); el(n + 'Panel').classList.add('open'); }
  function closeP(n) { el(n + 'Overlay').classList.remove('open'); el(n + 'Panel').classList.remove('open'); }
  function getChecked() { var r = []; el('apiList').querySelectorAll('.api-check:checked').forEach(function(c) { var i = parseInt(c.getAttribute('data-i')); if (apis[i]) r.push(apis[i]); }); return r; }
  function getName(u) { try { var p = new URL(u).pathname.split('/').filter(Boolean); return p[p.length - 1] || 'index'; } catch(e) { return (u || '').split('/').pop() || '?'; } }
  function shortUrl(u) { try { var x = new URL(u); return x.hostname + x.pathname.substring(0, 25) + (x.pathname.length > 25 ? '...' : ''); } catch(e) { return (u || '').substring(0, 35); } }
  function enc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(d) { if (!d) return ''; if (typeof d === 'string') try { return JSON.stringify(JSON.parse(d), null, 2); } catch(e) { return d; } return JSON.stringify(d, null, 2); }

  init();
})();
