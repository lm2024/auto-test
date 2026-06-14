(function() {
  var apis = [];
  var lastApisLength = 0;
  var settings = {};
  var editingIdx = -1;
  var chainList = [];
  var selectedChain = null;
  var replayResults = [];
  var replayLogs = [];
  var isReplayPaused = false;
  var isReplayStopped = false;
  var currentReplayer = null;
  var macroReplayFilter = null;

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
      if (area === 'local' && changes.settings) {
        settings = changes.settings.newValue || {};
        render();
      }
    });
  }

  function loadData() {
    chrome.storage.local.get(['isRecordingApi', 'isRecordingMacro', 'recordedApis', 'settings'], function(r) {
      var recApi = r.isRecordingApi || false;
      var recMacro = r.isRecordingMacro || false;
      var btnApi = el('recordApiBtn');
      var btnMacro = el('recordMacroBtn');
      var labelApi = narrow() ? (recApi ? '停止' : '接口') : (recApi ? '停止录制' : '录制接口');
      var labelMacro = narrow() ? (recMacro ? '停止' : '宏') : (recMacro ? '停止录制' : '录制宏');
      btnApi.textContent = labelApi;
      btnApi.className = recApi ? 'btn btn-stop' : 'btn';
      btnMacro.textContent = labelMacro;
      btnMacro.className = recMacro ? 'btn btn-stop' : 'btn';
      apis = r.recordedApis || []; lastApisLength = apis.length;
      if (r.settings) settings = r.settings;
      render();
    });
  }

  function bindAll() {
    el('recordApiBtn').addEventListener('click', function() {
      var isNarrow = narrow();
      var isRec = this.classList.contains('btn-stop');
      chrome.storage.local.set({ isRecordingApi: !isRec });
      chrome.runtime.sendMessage({ type: isRec ? 'STOP_RECORDING' : 'START_RECORDING' });
      if (!isRec) macroReplayFilter = null;
      var label = isNarrow ? (isRec ? '录制接口' : '停止') : (isRec ? '录制接口' : '停止录制');
      this.textContent = label;
      this.className = isRec ? 'btn' : 'btn btn-stop';
    });
    el('recordMacroBtn').addEventListener('click', function() {
      var isNarrow = narrow();
      var isRec = this.classList.contains('btn-stop');
      chrome.storage.local.set({ isRecordingMacro: !isRec });
      chrome.runtime.sendMessage({ type: isRec ? 'STOP_MACRO_RECORDING' : 'START_MACRO_RECORDING' });
      if (!isRec) {
        chrome.storage.local.set({ macroActions: [] });
      }
      var label = isNarrow ? (isRec ? '录制宏' : '停止') : (isRec ? '录制宏' : '停止录制');
      this.textContent = label;
      this.className = isRec ? 'btn' : 'btn btn-stop';
    });
    el('searchInput').addEventListener('input', render);
    el('methodFilter').addEventListener('change', render);
    el('statusFilter').addEventListener('change', render);
    el('resourceTypeFilter').addEventListener('change', render);
    el('filterMode').addEventListener('change', updateFilterHelp);
    el('pushBtn').addEventListener('click', openPush);
    el('exportBtn').addEventListener('click', doExport);
    el('genDocBtn').addEventListener('click', genDoc);
    el('clearBtn').addEventListener('click', function() { apis = []; lastApisLength = 0; macroReplayFilter = null; chrome.storage.local.set({ recordedApis: [] }); render(); });
    el('detailOverlay').addEventListener('click', function() { closeP('detail'); });
    el('detailClose').addEventListener('click', function() { closeP('detail'); });
    el('settingsOverlay').addEventListener('click', function() { closeP('settings'); });
    el('settingsClose').addEventListener('click', function() { closeP('settings'); });
    el('settingsBtn').addEventListener('click', openSettings);
    el('goPlatformBtn').addEventListener('click', function() {
      var url = (settings.frontendUrl || 'http://localhost:3001') + '/chain/list';
      window.open(url, '_blank');
    });
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
    el('selectAll').addEventListener('change', function() {
      var checked = this.checked;
      el('apiList').querySelectorAll('.api-check').forEach(function(c) { c.checked = checked; });
      var cnt = checked ? el('apiList').querySelectorAll('.api-check').length : 0;
      el('selText').textContent = '已选 ' + cnt + ' 条';
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        this.classList.add('active');
        el('tab-' + this.getAttribute('data-tab')).classList.add('active');
        if (this.getAttribute('data-tab') === 'chains') loadChainList();
      });
    });

    // Chain management
    el('chainSearch').addEventListener('input', renderChainList);
    el('chainMethodFilter').addEventListener('change', renderChainList);
    el('chainRefreshBtn').addEventListener('click', loadChainList);
    el('replayHttpBtn').addEventListener('click', function() { startReplay('http'); });
    el('replayBrowserBtn').addEventListener('click', function() { startReplay('browser'); });

    // Replay controls
    el('replayPauseBtn').addEventListener('click', togglePause);
    el('replayStopBtn').addEventListener('click', stopReplay);
    el('replayLogClearBtn').addEventListener('click', function() { replayLogs = []; renderReplayLog(); });
  }

  // ========== Tab: 录制 ==========
  function updateFilterHelp() {
    var mode = el('filterMode').value;
    var help = el('filterHelp');
    if (mode === 'off') help.textContent = '过滤模式已关闭，所有接口都会被录制。';
    else if (mode === 'ignore') help.textContent = '匹配的接口不会被录制。未配置的接口正常录制。留空则忽略全部。';
    else if (mode === 'whitelist') help.textContent = '只有匹配的接口才会被录制。未配置的接口不会被录制。留空则白名单失效（相当于关闭）。';
  }

  function shouldShowApi(url, settings) {
    if (!settings || !settings.filterMode || settings.filterMode === 'off') return true;
    var kwText = (settings.ignoreKeywords || '').trim();
    var domText = (settings.ignoreDomains || '').trim();
    if (!kwText && !domText) return true;
    var kwList = kwText.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var domList = domText.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    if (settings.filterMode === 'ignore') {
      for (var i = 0; i < kwList.length; i++) { if (url.indexOf(kwList[i]) !== -1) return false; }
      try { var u = new URL(url); for (var j = 0; j < domList.length; j++) { if (u.hostname === domList[j] || u.hostname.endsWith('.' + domList[j])) return false; } } catch(e) {}
      return true;
    }
    if (settings.filterMode === 'whitelist') {
      for (var k = 0; k < kwList.length; k++) { if (url.indexOf(kwList[k]) !== -1) return true; }
      try { var u2 = new URL(url); for (var m = 0; m < domList.length; m++) { if (u2.hostname === domList[m] || u2.hostname.endsWith('.' + domList[m])) return true; } } catch(e) {}
      return false;
    }
    return true;
  }

  function getResourceType(url) {
    if (!url) return 'other';
    var ext = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    if (/\.(js|mjs|cjs)(\?|$)/i.test(url)) return 'script';
    if (/\.(css)(\?|$)/i.test(url)) return 'stylesheet';
    if (/\.(png|jpg|jpeg|gif|svg|ico|webp|avif|bmp|tiff)(\?|$)/i.test(url)) return 'image';
    if (/\.(woff|woff2|ttf|eot|otf)(\?|$)/i.test(url)) return 'font';
    if (/\.(mp4|mp3|webm|ogg|wav|flac|aac)(\?|$)/i.test(url)) return 'media';
    if (/\.(html|htm|php|asp|aspx|jsp)(\?|$)/i.test(url)) return 'document';
    if (/^wss?:\/\//i.test(url)) return 'websocket';
    return 'fetch_xhr';
  }

  function render() {
    var search = (el('searchInput').value || '').toLowerCase();
    var method = el('methodFilter').value;
    var st = el('statusFilter').value;
    var rt = el('resourceTypeFilter').value;
    var checkedIdxs = {};
    el('apiList').querySelectorAll('.api-check:checked').forEach(function(c) { checkedIdxs[parseInt(c.getAttribute('data-i'))] = true; });

    var filtered = apis.filter(function(a) {
      if (method && a.method !== method) return false;
      if (st === 'success' && a.status > 0 && (a.status < 200 || a.status >= 300)) return false;
      if (st === 'error' && a.status >= 200 && a.status < 400) return false;
      if (search && a.url.toLowerCase().indexOf(search) === -1) return false;
      if (rt && a.resourceType !== rt) return false;
      if (macroReplayFilter) {
        var matched = false;
        for (var fi = 0; fi < macroReplayFilter.length; fi++) {
          if (a.url && a.url.indexOf(macroReplayFilter[fi]) !== -1) { matched = true; break; }
        }
        if (!matched) return false;
      }
      if (!shouldShowApi(a.url, settings)) return false;
      return true;
    });

    var statsLabel = narrow() ? (apis.length + '条 显' + filtered.length) : ('共 ' + apis.length + ' 条，显示 ' + filtered.length + ' 条');
    if (macroReplayFilter) {
      statsLabel += ' (链路筛选: ' + macroReplayFilter.length + ' 个接口)';
    }
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

  // ========== Tab: 链路管理 ==========
  function loadChainList() {
    var baseUrl = settings.platformUrl || 'http://localhost:8080';
    var search = el('chainSearch') ? el('chainSearch').value.trim() : '';
    var method = el('chainMethodFilter') ? el('chainMethodFilter').value : '';
    var url = baseUrl + '/api/plugin/chain/list?pageSize=100';
    if (search) url += '&keyword=' + encodeURIComponent(search);
    if (method) url += '&method=' + encodeURIComponent(method);

    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      if (d.code === 200) {
        chainList = d.data.list || [];
        renderChainList();
      }
    }).catch(function(e) {
      console.error('加载链路列表失败:', e);
    });
  }

  function renderChainList() {
    var search = (el('chainSearch') ? el('chainSearch').value : '').toLowerCase();
    var method = el('chainMethodFilter') ? el('chainMethodFilter').value : '';
    var list = el('chainList'), empty = el('chainEmptyHint');

    var filtered = chainList.filter(function(c) {
      if (search && (c.chainName || '').toLowerCase().indexOf(search) === -1) return false;
      return true;
    });

    el('chainStatsText').textContent = '共 ' + filtered.length + ' 条链路';

    if (filtered.length === 0) {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(empty); empty.style.display = '';
      el('replayHttpBtn').disabled = true; el('replayBrowserBtn').disabled = true;
      return;
    }
    empty.style.display = 'none';
    el('replayHttpBtn').disabled = !selectedChain;
    el('replayBrowserBtn').disabled = !selectedChain;

    var toRemove = [];
    for (var i = 0; i < list.childNodes.length; i++) { if (list.childNodes[i] !== empty) toRemove.push(list.childNodes[i]); }
    toRemove.forEach(function(n) { list.removeChild(n); });

    filtered.forEach(function(chain) {
      var div = document.createElement('div');
      div.className = 'chain-item' + (selectedChain && selectedChain.chainCode === chain.chainCode ? ' selected' : '');
      div.setAttribute('data-code', chain.chainCode);
      var modeLabel = chain.executeMode === 2 ? '分组并行' : '串行';
      div.innerHTML = '<div class="chain-name">' + enc(chain.chainName)
        + '<span class="badge badge-ver">v' + (chain.currentVersion || 1) + '</span></div>'
        + '<div class="chain-meta">'
        + '<span class="badge badge-mode">' + modeLabel + '</span>'
        + '<span>' + (chain.nodeCount || 0) + ' 个接口</span>'
        + '<span>' + (chain.chainCode || '') + '</span>'
        + '</div>'
        + '<div class="chain-versions" id="versions-' + chain.chainCode + '"></div>';
      div.addEventListener('click', function(e) {
        if (e.target.closest('.version-item')) return;
        selectedChain = chain;
        renderChainList();
        el('replayHttpBtn').disabled = false;
        el('replayBrowserBtn').disabled = false;
        loadChainVersions(chain.chainCode);
      });
      list.appendChild(div);
    });
  }

  function loadChainVersions(chainCode) {
    var baseUrl = settings.platformUrl || 'http://localhost:8080';
    var url = baseUrl + '/api/chain/versions?chainCode=' + encodeURIComponent(chainCode) + '&all=true';
    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      if (d.code === 200 && d.data && d.data.list) {
        renderChainVersions(chainCode, d.data.list);
      }
    }).catch(function(e) {
      console.error('加载版本失败:', e);
    });
  }

  function renderChainVersions(chainCode, versions) {
    var container = el('versions-' + chainCode);
    if (!container) return;
    container.innerHTML = '';
    if (!versions || versions.length === 0) {
      container.innerHTML = '<div style="padding:4px 12px;font-size:11px;color:var(--text-muted)">暂无版本</div>';
      return;
    }
    versions.forEach(function(v) {
      var div = document.createElement('div');
      div.className = 'version-item';
      div.setAttribute('data-version', v.version);
      var diff = v.diffSummary ? (' +' + (v.diffSummary.added||0) + ' -' + (v.diffSummary.removed||0) + ' ~' + (v.diffSummary.modified||0)) : '';
      var time = v.createTime ? new Date(v.createTime).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
      div.innerHTML = '<span class="version-label">v' + v.version + '</span>'
        + '<span class="version-info">' + (v.nodeCount || 0) + '个接口 ' + diff + '</span>'
        + '<span class="version-time">' + time + '</span>';
      div.addEventListener('click', function(e) {
        e.stopPropagation();
        container.querySelectorAll('.version-item').forEach(function(item) { item.classList.remove('selected'); });
        div.classList.add('selected');
        selectedChain = { chainCode: chainCode, chainName: selectedChain ? selectedChain.chainName : '', currentVersion: v.version };
        el('replayHttpBtn').disabled = false;
        el('replayBrowserBtn').disabled = false;
      });
      container.appendChild(div);
    });
  }

  // ========== Tab: 回放日志 ==========
  function addReplayLog(type, msg) {
    var now = new Date();
    var time = now.toLocaleTimeString('zh-CN', { hour12: false });
    replayLogs.push({ type: type, msg: msg, time: time });
    renderReplayLog();
  }

  function renderReplayLog() {
    var list = el('replayLogList'), empty = el('replayLogEmpty');
    var actions = el('replayActions');

    if (replayLogs.length === 0) {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.appendChild(empty); empty.style.display = '';
      actions.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    actions.style.display = 'flex';

    var toRemove = [];
    for (var i = 0; i < list.childNodes.length; i++) { if (list.childNodes[i] !== empty) toRemove.push(list.childNodes[i]); }
    toRemove.forEach(function(n) { list.removeChild(n); });

    replayLogs.forEach(function(log) {
      var div = document.createElement('div');
      div.className = 'log-item';
      var icon = log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : log.type === 'info' ? 'ℹ' : '⏳';
      var iconColor = log.type === 'success' ? 'var(--success)' : log.type === 'error' ? 'var(--danger)' : 'var(--text-muted)';
      div.innerHTML = '<span class="log-time">' + enc(log.time) + '</span>'
        + '<span class="log-icon" style="color:' + iconColor + '">' + icon + '</span>'
        + '<span class="log-msg">' + log.msg + '</span>';
      list.appendChild(div);
    });

    list.scrollTop = list.scrollHeight;
  }

  // ========== 回放引擎 ==========
  function startReplay(mode) {
    if (!selectedChain) { alert('请先选择一个链路'); return; }
    var baseUrl = settings.platformUrl || 'http://localhost:8080';

    // 加载链路详情
    fetch(baseUrl + '/api/plugin/chain/detail?chainCode=' + encodeURIComponent(selectedChain.chainCode))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.code !== 200) { alert('加载链路详情失败: ' + d.message); return; }
        var chain = d.data;
        if (!chain.nodeList || chain.nodeList.length === 0) { alert('链路中没有接口'); return; }

        // 切换到回放日志Tab
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        document.querySelector('[data-tab="replayLog"]').classList.add('active');
        el('tab-replayLog').classList.add('active');
        el('replayLogTitle').textContent = '回放日志 — ' + chain.chainName;

        replayResults = [];
        isReplayPaused = false;
        isReplayStopped = false;

        addReplayLog('info', '开始' + (mode === 'http' ? 'HTTP' : '浏览器') + '回放: ' + chain.chainName + '，共 ' + chain.nodeList.length + ' 个接口');

        if (mode === 'http') {
          httpReplay(chain);
        } else {
          browserReplay(chain);
        }
      })
      .catch(function(e) { alert('加载链路失败: ' + e.message); });
  }

  function httpReplay(chain) {
    var nodes = chain.nodeList.sort(function(a, b) { return (a.sortNo || 0) - (b.sortNo || 0); });
    var idx = 0;
    var intervalMs = (settings.replayInterval || 0) * 1000;

    function executeNext() {
      if (isReplayStopped) {
        addReplayLog('info', '回放已停止');
        updateReplayActions(false);
        return;
      }
      if (isReplayPaused) {
        setTimeout(executeNext, 200);
        return;
      }
      if (idx >= nodes.length) {
        addReplayLog('success', '回放完成! 成功: ' + replayResults.filter(function(r) { return r.status === 'SUCCESS'; }).length
          + '/' + nodes.length + '，失败: ' + replayResults.filter(function(r) { return r.status === 'FAILED'; }).length);
        updateReplayActions(false);
        return;
      }

      var node = nodes[idx];
      var startTime = Date.now();
      addReplayLog('info', '[' + (idx + 1) + '/' + nodes.length + '] 正在执行: ' + (node.nodeName || '节点' + (idx + 1)));

      var fetchOpts = {
        method: node.requestMethod || 'GET',
        headers: parseHeaders(node.requestHeaders),
        credentials: 'include'
      };
      if (['POST', 'PUT', 'PATCH'].indexOf(fetchOpts.method) >= 0 && node.bodyData) {
        fetchOpts.body = node.bodyData;
      }

      fetch(node.requestUrl, fetchOpts)
        .then(function(resp) {
          var duration = Date.now() - startTime;
          return resp.text().then(function(body) {
            var result = {
              node: node,
              nodeName: node.nodeName || '节点' + (idx + 1),
              requestUrl: node.requestUrl,
              requestMethod: node.requestMethod,
              requestHeaders: node.requestHeaders,
              bodyData: node.bodyData,
              responseCode: resp.status,
              responseHeaders: JSON.stringify(Object.fromEntries(resp.headers.entries())),
              responseBody: body,
              durationMs: duration,
              sort: idx + 1,
              status: 'SUCCESS'
            };
            replayResults.push(result);
            addReplayLog('success', '<span class="node-name">' + enc(result.nodeName) + '</span> <span class="status ok">' + resp.status + '</span> <span class="cost">' + duration + 'ms</span>');
            idx++;
            if (intervalMs > 0 && idx < nodes.length) {
              addReplayLog('info', '等待 ' + settings.replayInterval + ' 秒后执行下一步...');
              setTimeout(executeNext, intervalMs);
            } else {
              executeNext();
            }
          });
        })
        .catch(function(err) {
          var duration = Date.now() - startTime;
          var result = {
            node: node,
            nodeName: node.nodeName || '节点' + (idx + 1),
            requestUrl: node.requestUrl,
            requestMethod: node.requestMethod,
            requestHeaders: node.requestHeaders,
            bodyData: node.bodyData,
            responseCode: 0,
            responseHeaders: '',
            responseBody: err.message,
            durationMs: duration,
            sort: idx + 1,
            status: 'FAILED'
          };
          replayResults.push(result);
          addReplayLog('error', '<span class="node-name">' + enc(result.nodeName) + '</span> <span class="status err">失败</span> <span class="cost">' + duration + 'ms</span> — ' + enc(err.message));
          idx++;
          if (intervalMs > 0 && idx < nodes.length) {
            addReplayLog('info', '等待 ' + settings.replayInterval + ' 秒后执行下一步...');
            setTimeout(executeNext, intervalMs);
          } else {
            executeNext();
          }
        });
    }

    updateReplayActions(true);
    executeNext();
  }

  function browserReplay(chain) {
    var baseUrl = settings.platformUrl || 'http://localhost:8080';
    var url = baseUrl + '/api/plugin/chain/detail?chainCode=' + encodeURIComponent(chain.chainCode);

    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      if (d.code !== 200 || !d.data || !d.data.nodeList) {
        addReplayLog('error', '加载链路详情失败');
        return;
      }

      var nodeList = d.data.nodeList;
      var macroActions = null;
      var firstUrl = '';
      var chainUrls = [];

      for (var i = 0; i < nodeList.length; i++) {
        if (nodeList[i].nodeType === 'MACRO' && nodeList[i].bodyData) {
          try { macroActions = JSON.parse(nodeList[i].bodyData); } catch(e) {}
        }
        if (nodeList[i].requestUrl && nodeList[i].nodeType !== 'MACRO') {
          if (!firstUrl) firstUrl = nodeList[i].requestUrl;
          chainUrls.push(nodeList[i].requestUrl);
        }
      }

      macroReplayFilter = chainUrls.length > 0 ? chainUrls : null;

      if (!macroActions || macroActions.length === 0) {
        addReplayLog('error', '该链路没有宏操作数据，无法回放');
        return;
      }

      var origin = '';
      try { origin = new URL(firstUrl).origin; } catch(e) { origin = firstUrl; }

      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      document.querySelector('[data-tab="replayLog"]').classList.add('active');
      el('tab-replayLog').classList.add('active');
      el('replayLogTitle').textContent = '回放日志 — ' + chain.chainName;

      replayLogs = [];
      renderReplayLog();
      replayResults = [];
      isReplayPaused = false;
      isReplayStopped = false;

      addReplayLog('info', '开始宏回放: ' + chain.chainName + '，共 ' + macroActions.length + ' 个操作步骤');
      addReplayLog('info', '正在打开页面: ' + origin);

      chrome.tabs.create({ url: origin, active: true }, function(tab) {
        chrome.storage.local.set({ macroActions: [] });
        chrome.runtime.sendMessage({ type: 'CLEAR_APIS' });
        chrome.runtime.sendMessage({ type: 'START_RECORDING' });

        setTimeout(function() {
          addReplayLog('info', '正在发送宏操作到页面...');
          chrome.tabs.sendMessage(tab.id, { type: 'START_MACRO_REPLAY', actions: macroActions, settings: settings });
        }, 2000);

        updateReplayActions(true);
        selectedChain = chain;

        chrome.storage.onChanged.addListener(function onChange(changes) {
          if (changes.macroReplayResult && changes.macroReplayResult.newValue) {
            var res = changes.macroReplayResult.newValue;
            addReplayLog('success', '宏回放完成! 执行: ' + res.executed + '/' + res.total + (res.stopped ? ' (已停止)' : ''));
            addReplayLog('info', '捕获到的接口已出现在「录制」标签页，请查看并推送至平台');

            setTimeout(function() {
              document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
              document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
              document.querySelector('[data-tab="record"]').classList.add('active');
              el('tab-record').classList.add('active');
            }, 1500);

            chrome.storage.onChanged.removeListener(onChange);
          }
        });
      });
    }).catch(function(e) {
      addReplayLog('error', '加载链路失败: ' + e.message);
    });
  }

  function parseHeaders(headerStr) {
    try {
      var h = typeof headerStr === 'string' ? JSON.parse(headerStr || '{}') : (headerStr || {});
      return h;
    } catch(e) { return {}; }
  }

  function togglePause() {
    isReplayPaused = !isReplayPaused;
    el('replayPauseBtn').innerHTML = isReplayPaused
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polygon points="5 3 19 12 5 21 5 3"/></svg> 继续'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> 暂停';
    addReplayLog('info', isReplayPaused ? '已暂停' : '已继续');
  }

  function stopReplay() {
    isReplayStopped = true;
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    chrome.storage.local.get(['macroActions'], function(r) {
      var count = (r.macroActions || []).length;
      if (count > 0) {
        addReplayLog('success', '录制已停止，共录制 ' + count + ' 个操作步骤');
      } else {
        addReplayLog('info', '录制已停止');
      }
      updateReplayActions(false);
    });
  }

  function updateReplayActions(isReplaying) {
    el('replayActions').style.display = 'flex';
    el('replayPauseBtn').disabled = !isReplaying;
    el('replayStopBtn').disabled = !isReplaying;
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

  // ========== OpenAPI ==========
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
    el('filterMode').value = settings.filterMode || 'off';
    el('cfgKw').value = settings.ignoreKeywords || '';
    el('cfgDomains').value = settings.ignoreDomains || '';
    el('cfgMode').value = settings.idMode || 'AUTO_INCREMENT';
    el('cfgStep').value = settings.idStep || 1;
    el('cfgVersionMode').value = settings.versionMode || 'auto';
    el('cfgReplayTimeout').value = settings.replayTimeout || 30;
    el('cfgReplayInterval').value = settings.replayInterval || 0;
    el('cfgFailStrategy').value = settings.failStrategy || 'continue';
    el('cfgParallelGroup').value = settings.enableParallelGroup !== false ? 'true' : 'false';
    updateFilterHelp();
    openP('settings');
  }
  function saveSettings() {
    settings.platformUrl = el('cfgUrl').value.trim();
    settings.frontendUrl = el('cfgFrontendUrl').value.trim();
    settings.filterMode = el('filterMode').value;
    settings.ignoreKeywords = el('cfgKw').value;
    settings.ignoreDomains = el('cfgDomains').value;
    settings.idMode = el('cfgMode').value;
    settings.idStep = parseInt(el('cfgStep').value) || 1;
    settings.versionMode = el('cfgVersionMode').value;
    settings.replayTimeout = parseInt(el('cfgReplayTimeout').value) || 30;
    settings.replayInterval = parseFloat(el('cfgReplayInterval').value) || 0;
    settings.failStrategy = el('cfgFailStrategy').value;
    settings.enableParallelGroup = el('cfgParallelGroup').value === 'true';
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

    chrome.storage.local.get(['macroActions'], function(macroR) {
      var macroActions = macroR.macroActions || [];
      var ifList = list.map(function(a, i) { return { nodeName: a.nodeName || getName(a.url), method: a.method || 'GET', url: a.url, headers: a.headers ? JSON.stringify(a.headers) : '', bodyData: a.body || '', responseData: typeof a.response === 'string' ? a.response : JSON.stringify(a.response || ''), sort: i + 1, parallelGroup: '' }; });

      if (macroActions.length > 0) {
        ifList.push({
          nodeName: '宏操作 (' + macroActions.length + ' 步)',
          method: 'MACRO',
          url: macroActions[0] ? macroActions[0].pageUrl : '',
          headers: '',
          bodyData: JSON.stringify(macroActions),
          responseData: JSON.stringify(macroActions),
          sort: ifList.length + 1,
          parallelGroup: ''
        });
      }

      var url = (settings.platformUrl || 'http://localhost:8080') + '/api/plugin/chain/' + (mode === 'create' ? 'create' : 'append');
      var body = mode === 'create' ? JSON.stringify({ chainName: name, interfaceList: ifList }) : JSON.stringify({ chainCode: code, interfaceList: ifList });
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }).then(function(r) { return r.json(); }).then(function(d) {
        if (d.code === 200) {
          var code = d.data.chainCode || code;
          el('pushDialog').classList.remove('open');
          var platformUrl = (settings.frontendUrl || 'http://localhost:3001') + '/chain/edit/' + code;
          if (confirm('推送成功！链路编码: ' + code + '\n\n是否跳转到平台查看？')) {
            window.open(platformUrl, '_blank');
          }
        }
        else alert('失败: ' + (d.message || ''));
      }).catch(function(e) { alert('失败: ' + e.message); });
    });
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
