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
  var apiBtnState = 'idle'; // idle | recording | stopped
  var stoppedTimer = null;

  function el(id) { return document.getElementById(id); }
  function narrow() { return window.innerWidth <= 360; }

  function init() {
    document.querySelector('.app').classList.add('slide-in');
    bindAll();
    loadData();
    pollWindowState();
    // 注册登录面板处理器 + 登录态变化监听 + 启动探活
    if (window.PlatformApi) PlatformApi.setLoginHandler(openAuthPanel);
    if (window.PlatformAuth) PlatformAuth.onChange(function() { updateAuthBadge(); });
    probeLogin();
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

  var currentBizTrace = null;
  var windowPollTimer = null;

  function pollWindowState() {
    chrome.runtime.sendMessage({ type: 'GET_BIZ_TRACE_STATE' }, function(resp) {
      if (resp) {
        currentBizTrace = resp.currentTrace;
        updateWindowIndicator();
      }
    });
    windowPollTimer = setTimeout(pollWindowState, 1000);
  }

  function updateWindowIndicator() {
    var indicator = el('windowIndicator');
    var dot = el('windowDot');
    var info = el('windowInfo');
    var trace = el('windowTrace');
    if (!indicator) return;
    if (apiBtnState !== 'recording') {
      indicator.classList.remove('show');
      return;
    }
    indicator.classList.add('show');
    if (currentBizTrace && currentBizTrace.windowActive) {
      dot.className = 'window-dot active';
      var remain = Math.max(0, Math.ceil((currentBizTrace.expiresAt - Date.now()) / 1000));
      info.textContent = '窗口激活中 (' + remain + 's)';
      trace.textContent = currentBizTrace.traceId ? currentBizTrace.traceId.substring(0, 22) : '';
    } else {
      dot.className = 'window-dot idle';
      info.textContent = '等待操作...';
      trace.textContent = '';
    }
  }

  function loadData() {
    chrome.storage.local.get(['isRecordingApi', 'recordedApis', 'settings'], function(r) {
      var recApi = r.isRecordingApi || false;
      // 根据实际状态设置按钮
      if (recApi) {
        apiBtnState = 'recording';
      } else if (apiBtnState === 'recording') {
        // 从录制中变为停止
        apiBtnState = 'stopped';
      }
      updateApiButton();
      apis = r.recordedApis || []; lastApisLength = apis.length;
      if (r.settings) settings = r.settings;
      render();
    });
  }

  function updateApiButton() {
    var btn = el('recordApiBtn');
    var isN = narrow();
    if (apiBtnState === 'recording') {
      btn.textContent = isN ? '停止' : '停止录制';
      btn.className = 'btn btn-stop';
    } else if (apiBtnState === 'stopped') {
      btn.textContent = '已停止 ✓';
      btn.className = 'btn btn-stopped';
      if (stoppedTimer) clearTimeout(stoppedTimer);
      stoppedTimer = setTimeout(function() {
        apiBtnState = 'idle';
        updateApiButton();
      }, 2000);
    } else {
      btn.textContent = isN ? '录制' : '开始录制';
      btn.className = 'btn';
    }
  }

  function bindAll() {
    el('hidePanelBtn').addEventListener('click', hidePanel);
    el('recordApiBtn').addEventListener('click', function() {
      var isRec = apiBtnState === 'recording';
      apiBtnState = isRec ? 'stopped' : 'recording';
      chrome.storage.local.set({ isRecordingApi: !isRec });
      if (isRec) {
        // 停止录制：停止接口录制 + 停止宏录制
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
        chrome.runtime.sendMessage({ type: 'STOP_MACRO_RECORDING' });
        // 从内容脚本获取宏操作并保存
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_MACRO_RECORDING' }, function(resp) {
              if (chrome.runtime.lastError || !resp) return;
              var actions = (resp && resp.actions) ? resp.actions : [];
              if (actions.length > 0) {
                chrome.storage.local.set({ macroActions: actions });
              }
            });
          }
        });
      } else {
        // 开始录制：清空之前的操作，START_RECORDING 会同时启动接口和宏录制
        chrome.storage.local.set({ macroActions: [] });
        chrome.runtime.sendMessage({ type: 'START_RECORDING' });
      }
      macroReplayFilter = null;
      updateApiButton();
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
    el('authBtn').addEventListener('click', openAuthPanel);
    el('goPlatformBtn').addEventListener('click', function() {
      var url = (getConfig().FRONTEND_URL || 'http://localhost:9094') + '/chain/list';
      window.open(url, '_blank');
    });
    el('saveSettingsBtn').addEventListener('click', saveSettings);
    el('clearAuthTokens').addEventListener('click', function() {
      chrome.storage.local.set({ authContext: {} });
      el('authTokenList').innerHTML = '<span style="color:var(--text-muted)">认证信息已清除。</span>';
    });
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
    var dbgAddBtn = document.getElementById('dbgAddHeaderBtn');
    if (dbgAddBtn) dbgAddBtn.addEventListener('click', function() { addDbgHeader(); });
    var dbgCloseBtn = document.getElementById('dbgCloseBtn');
    if (dbgCloseBtn) dbgCloseBtn.addEventListener('click', function() { el('dbgDialog').classList.remove('open'); });
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
    updateWindowIndicator();
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

    // 按 bizOperTraceId 分组
    var groups = {};
    var ungrouped = [];
    filtered.forEach(function(a) {
      var traceId = a.bizOperTraceId || '';
      if (traceId && traceId !== '') {
        if (!groups[traceId]) groups[traceId] = { traceId: traceId, items: [], event: a.triggerEvent || 'auto', pageUrl: a.pageUrl || '' };
        groups[traceId].items.push(a);
      } else {
        ungrouped.push(a);
      }
    });

    var toRemove = [];
    for (var i = 0; i < list.childNodes.length; i++) { if (list.childNodes[i] !== empty) toRemove.push(list.childNodes[i]); }
    toRemove.forEach(function(n) { list.removeChild(n); });

    // 渲染分组
    var groupKeys = Object.keys(groups);
    groupKeys.forEach(function(traceId) {
      var g = groups[traceId];
      var groupDiv = document.createElement('div');
      groupDiv.className = 'trace-group';
      var shortTrace = traceId.length > 20 ? traceId.substring(0, 20) + '...' : traceId;
      var eventLabel = g.event === 'click' ? '点击' : g.event === 'change' ? '选择' : g.event === 'keydown' ? '回车' : g.event === 'submit' ? '提交' : g.event;
      var shortPage = g.pageUrl ? (function() { try { return new URL(g.pageUrl).pathname; } catch(e) { return g.pageUrl.substring(0, 30); } })() : '';
      groupDiv.innerHTML = '<div class="trace-group-header">'
        + '<span class="trace-id" title="' + enc(traceId) + '">' + enc(shortTrace) + '</span>'
        + '<span class="trace-event">' + enc(eventLabel) + '</span>'
        + '<span class="trace-page" title="' + enc(g.pageUrl) + '">' + enc(shortPage) + '</span>'
        + '<span class="trace-count">' + g.items.length + ' 条</span>'
        + '</div><div class="trace-group-body"></div>';
      var body = groupDiv.querySelector('.trace-group-body');
      g.items.forEach(function(a) { body.appendChild(createApiItem(a, checkedIdxs)); });
      groupDiv.querySelector('.trace-group-header').addEventListener('click', function() {
        groupDiv.classList.toggle('collapsed');
      });
      list.appendChild(groupDiv);
    });

    // 渲染未分组
    ungrouped.forEach(function(a) { list.appendChild(createApiItem(a, checkedIdxs)); });

    bindListEvents(list);
  }

  function createApiItem(a, checkedIdxs) {
    var idx = apis.indexOf(a);
    var ok = a.status >= 200 && a.status < 300;
    var nm = a.nodeName || getName(a.url);
    var m = (a.method || 'GET').toUpperCase();
    var chk = checkedIdxs[idx] ? ' checked' : '';
    var ignoreClass = a.ignore ? ' api-item-ignored' : '';
    var div = document.createElement('div');
    div.className = 'api-item' + ignoreClass; div.setAttribute('data-i', idx); div.setAttribute('draggable', 'true');
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
    return div;
  }

  function bindListEvents(list) {
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

  // 固定配置读取：前后端地址来自 config.js（不可由用户修改）
  function getConfig() {
    return (window.AUTOTEST_CONFIG || { PLATFORM_URL: 'http://localhost:9093', FRONTEND_URL: 'http://localhost:9094' });
  }

  function sec(title, data, field, idx) {
    return '<div class="detail-section"><div class="detail-section-hd">' + title + ' <button class="cpy-btn" data-f="' + field + '" data-i="' + idx + '">复制</button></div><pre>' + (fmt(data) || '(空)') + '</pre></div>';
  }

  // ========== Tab: 链路管理 ==========
  function loadChainList() {
    var baseUrl = (getConfig().PLATFORM_URL || 'http://localhost:9093');
    var search = el('chainSearch') ? el('chainSearch').value.trim() : '';
    var method = el('chainMethodFilter') ? el('chainMethodFilter').value : '';
    var query = { pageSize: 100 };
    if (search) query.keyword = search;
    if (method) query.method = method;

    window.PlatformApi.apiFetch('/api/plugin/chain/list', { query: query })
      .then(function(d) {
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
    window.PlatformApi.apiFetch('/api/chain/versions', { query: { chainCode: chainCode, all: true } })
      .then(function(d) {
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
    var baseUrl = (getConfig().PLATFORM_URL || 'http://localhost:9093');

    // 加载链路详情
    window.PlatformApi.apiFetch('/api/plugin/chain/detail', { query: { chainCode: selectedChain.chainCode } })
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
    window.PlatformApi.apiFetch('/api/plugin/chain/detail', { query: { chainCode: chain.chainCode } })
      .then(function(d) {
      if (d.code !== 200 || !d.data || !d.data.nodeList) {
        addReplayLog('error', '加载链路详情失败');
        return;
      }

      var nodeList = d.data.nodeList;
      console.log('[AutoTest][browserReplay] nodeList:', nodeList.length, 'nodes');
      nodeList.forEach(function(n, i) {
        console.log('[AutoTest][browserReplay] node[' + i + ']:', n.nodeType, n.nodeName, n.requestMethod, (n.bodyData || '').substring(0, 80));
      });
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

      // 从宏操作中找到最早的有效页面 URL
      var origin = '';
      var originHost = '';
      var ignoreHosts = ['zhihu-web-analytics', 'google-analytics', 'analytics', 'beacon', 'track', 'log', 'stat', 'monitor'];
      for (var j = 0; j < macroActions.length; j++) {
        if (macroActions[j].pageUrl) {
          try {
            var parsedUrl = new URL(macroActions[j].pageUrl);
            if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
              // 跳过 analytics/tracking 域名
              var isAnalytics = ignoreHosts.some(function(h) { return parsedUrl.hostname.indexOf(h) !== -1; });
              if (!isAnalytics && !origin) {
                origin = parsedUrl.href;
                originHost = parsedUrl.hostname;
              }
              // 如果后续有同域名的完整路径，优先使用
              if (!isAnalytics && originHost && parsedUrl.hostname === originHost && parsedUrl.pathname !== '/') {
                origin = parsedUrl.href;
              }
            }
          } catch(e) {}
        }
      }
      // 回退：从接口 URL 提取 origin
      if (!origin) {
        try { origin = new URL(firstUrl).origin; } catch(e) { origin = firstUrl; }
      }

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

        function sendReplay() {
          addReplayLog('info', '正在发送宏操作到页面...');
          chrome.tabs.sendMessage(tab.id, { type: 'START_MACRO_REPLAY', actions: macroActions, settings: settings });
        }
        // 等待新标签页加载完成后再发送（替换原固定 2s 等待，更稳）
        var sent = false;
        chrome.tabs.onUpdated.addListener(function onUp(tId, info) {
          if (tId === tab.id && info.status === 'complete' && !sent) {
            sent = true;
            chrome.tabs.onUpdated.removeListener(onUp);
            setTimeout(sendReplay, 800);
          }
        });
        setTimeout(sendReplay, 5000); // 兜底：5s 后无论如何都发

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
    var inK = document.createElement('input');
    inK.placeholder = 'Header名'; inK.value = k || '';
    var inV = document.createElement('input');
    inV.placeholder = 'Header值'; inV.value = v || '';
    var del = document.createElement('button');
    del.className = 'dbg-kv-btn'; del.textContent = '×';
    del.addEventListener('click', function() { row.remove(); });
    row.appendChild(inK); row.appendChild(inV); row.appendChild(del);
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
    return { openapi: '3.0.0', info: { title: 'API Documentation', version: '1.0.0', description: '自动录制生成' }, servers: [{ url: url.origin }], paths: pathObj };
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
    el('filterMode').value = settings.filterMode || 'off';
    el('cdpCapture').checked = settings.cdpCapture === true;
    el('cfgKw').value = settings.ignoreKeywords || '';
    el('cfgDomains').value = settings.ignoreDomains || '';
    el('cfgMode').value = settings.idMode || 'AUTO_INCREMENT';
    el('cfgStep').value = settings.idStep || 1;
    el('cfgVersionMode').value = settings.versionMode || 'auto';
    el('cfgReplayTimeout').value = settings.replayTimeout || 30;
    el('cfgReplayInterval').value = settings.replayInterval || 0;
    el('cfgFailStrategy').value = settings.failStrategy || 'continue';
    el('cfgParallelGroup').value = settings.enableParallelGroup !== false ? 'true' : 'false';
    // Phase 4: Encryption config
    el('cfgEncryptEnabled').value = settings.encryptEnabled ? 'true' : 'false';
    el('cfgDecryptRequest').value = settings.decryptRequestCode || '';
    el('cfgDecryptResponse').value = settings.decryptResponseCode || '';
    el('cfgEncryptAlgo').value = settings.encryptAlgo || 'AES';
    updateFilterHelp();
    loadAuthTokenList();
    openP('settings');
  }
  function saveSettings() {
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
    // Phase 4: Encryption config
    settings.encryptEnabled = el('cfgEncryptEnabled').value === 'true';
    settings.decryptRequestCode = el('cfgDecryptRequest').value;
    settings.decryptResponseCode = el('cfgDecryptResponse').value;
    settings.encryptAlgo = el('cfgEncryptAlgo').value;
    settings.cdpCapture = el('cdpCapture').checked;
    chrome.storage.local.set({ settings: settings });
    // 实时同步 CDP 抓包开关到后台（录制中开启会 attach，关闭会 detach）
    chrome.runtime.sendMessage({ type: 'SET_CDP_CAPTURE', enabled: settings.cdpCapture });
    alert('设置已保存'); closeP('settings'); render();
  }
  function loadAuthTokenList() {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_CONTEXT' }, function(resp) {
      var tokens = (resp && resp.tokens) || {};
      var html = '';
      var keys = Object.keys(tokens);
      if (keys.length === 0) {
        html = '<span style="color:var(--text-muted)">录制期间自动提取的认证信息将显示在此处。</span>';
      } else {
        keys.forEach(function(k) {
          var v = String(tokens[k]);
          if (v.length > 60) v = v.substring(0, 30) + '...' + v.substring(v.length - 20);
          html += '<div style="margin-bottom:4px"><b>' + enc(k) + ':</b> <code style="font-size:10px;word-break:break-all">' + enc(v) + '</code></div>';
        });
      }
      el('authTokenList').innerHTML = html;
    });
  }

  // ========== 平台登录鉴权 ==========
  // 依赖 window.PlatformAuth (auth.js) 与 window.PlatformApi (platform-api.js)
  function getSettings() {
    return new Promise(function (res) {
      chrome.storage.local.get(['settings'], function (r) { res(r.settings || {}); });
    });
  }
  function currentBaseUrl() {
    var s = getConfig().PLATFORM_URL || '';
    return s.replace(/\/+$/, '');
  }

  async function updateAuthBadge() {
    var btn = el('authBtn');
    if (!btn || !window.PlatformAuth) return;
    var s = await getSettings();
    var base = (getConfig().PLATFORM_URL || '').replace(/\/+$/, '');
    var state = await window.PlatformAuth.getState(base);
    var labelLg = btn.querySelector('.btn-label-lg');
    var labelSm = btn.querySelector('.btn-label-sm');
    var obj = await window.PlatformAuth.get();
    var username = obj && obj.user && obj.user.username ? obj.user.username : '';
    btn.classList.remove('btn-authed');
    if (state === 'AUTHED') {
      btn.title = '已登录' + (username ? '（' + username + '）' : '');
      btn.classList.add('btn-authed');
      if (labelLg) labelLg.textContent = username || '已登录';
      if (labelSm) labelSm.textContent = username || '已登录';
    } else if (state === 'EXPIRED') {
      btn.title = '登录已过期，点击重新登录';
      if (labelLg) labelLg.textContent = '重新登录';
      if (labelSm) labelSm.textContent = '登录';
    } else if (state === 'MISMATCH') {
      btn.title = '登录环境与当前后端不一致，请重新登录';
      if (labelLg) labelLg.textContent = '环境不符';
      if (labelSm) labelSm.textContent = '登录';
    } else {
      btn.title = '未登录，点击登录';
      if (labelLg) labelLg.textContent = '登录';
      if (labelSm) labelSm.textContent = '登录';
    }
  }

  async function probeLogin() {
    if (!window.PlatformAuth || !window.PlatformApi) { updateAuthBadge(); return; }
    var s = await getSettings();
    var base = (getConfig().PLATFORM_URL || '').replace(/\/+$/, '');
    if (!base) { updateAuthBadge(); return; }
    var state = await window.PlatformAuth.getState(base);
    if (state === 'ANONYMOUS' || state === 'MISMATCH') { updateAuthBadge(); return; }
    // AUTHED / EXPIRED：以服务端校验为准
    try {
      await window.PlatformApi.apiFetch('/api/user/me', { retryOn401: false, silent: true });
      updateAuthBadge();
    } catch (e) {
      if (e && e.type === 'UNAUTHORIZED') {
        await window.PlatformAuth.clear(); // 服务端已拒绝此令牌 → 清除，避免误判为已登录
      } else {
        updateAuthBadge(); // NETWORK/其他：可能只是后端暂时不可达，保留本地令牌
      }
    }
  }

  function openAuthPanel() {
    var body = el('authBody');
    if (!body) return;
    body.innerHTML =
      '<div class="auth-form">'
      + '<div class="auth-hint" id="authMsg"></div>'
      + '<div class="form-g"><label>用户名</label><input type="text" id="authUser" placeholder="请输入用户名" autocomplete="username"></div>'
      + '<div class="form-g"><label>密码</label><input type="password" id="authPwd" placeholder="请输入密码" autocomplete="current-password"></div>'
      + '<div class="form-g"><label>验证码</label>'
      + '<div class="captcha-row">'
      + '<input type="text" id="authCaptchaInput" placeholder="请输入右侧验证码" maxlength="6" autocomplete="off">'
      + '<img id="authCaptchaImg" class="captcha-img" alt="验证码" title="点击刷新">'
      + '</div></div>'
      + '<button class="btn-solid btn-primary" id="authLoginBtn" style="width:100%;margin-top:6px">登录</button>'
      + '<button class="btn-solid btn-outline" id="authSyncBtn" style="width:100%;margin-top:8px">同步平台登录态</button>'
      + '<div class="auth-tip">若已在浏览器中登录本平台（同一后端），可一键同步登录态，无需重复输入账号密码。</div>'
      + '</div>';

    el('authOverlay').addEventListener('click', closeAuthPanel);
    el('authClose').addEventListener('click', closeAuthPanel);
    el('authCaptchaImg').addEventListener('click', loadCaptcha);
    el('authLoginBtn').addEventListener('click', submitAuthLogin);
    el('authSyncBtn').addEventListener('click', syncPlatformLogin);
    el('authPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitAuthLogin(); });
    loadCaptcha();
    openP('auth');
  }

  function closeAuthPanel() {
    closeP('auth');
    // 若是 401 触发的登录（存在挂起的 waitForLogin），关闭即视为放弃 → 让重放失败
    if (window.PlatformApi) window.PlatformApi.resolveLogin(false);
  }

  var currentCaptchaToken = '';
  async function loadCaptcha() {
    var img = el('authCaptchaImg');
    var msg = el('authMsg');
    if (!img) return;
    try {
      var d = await window.PlatformApi.apiFetch('/api/captcha', { auth: false, silent: true });
      if (d && d.code === 200 && d.data) {
        currentCaptchaToken = d.data.token || '';
        img.src = d.data.image || '';
        if (msg) { msg.textContent = ''; msg.className = 'auth-hint'; }
      } else if (msg) {
        msg.textContent = '验证码加载失败，请重试'; msg.className = 'auth-hint err';
      }
    } catch (e) {
      if (msg) { msg.textContent = (e && e.message) || '验证码加载失败，请重试'; msg.className = 'auth-hint err'; }
    }
  }

  async function submitAuthLogin() {
    var msg = el('authMsg');
    var user = el('authUser').value.trim();
    var pwd = el('authPwd').value;
    var cap = el('authCaptchaInput').value.trim();
    if (!user || !pwd || !cap) { if (msg) { msg.textContent = '请填写用户名、密码与验证码'; msg.className = 'auth-hint err'; } return; }
    var btn = el('authLoginBtn'); btn.disabled = true; btn.textContent = '登录中...';
    try {
      var d = await window.PlatformApi.apiFetch('/api/user/login', {
        method: 'POST', auth: false, silent: true,
        body: { username: user, password: pwd, captcha: cap, captchaToken: currentCaptchaToken }
      });
      if (d && d.code === 200 && d.data && d.data.token) {
        var token = d.data.token;
        var exp = window.PlatformAuth.parseExp(token);
        var boundUrl = currentBaseUrl();
        await window.PlatformAuth.set({ token: token, user: d.data.user || null, exp: exp, boundUrl: boundUrl });
        if (msg) { msg.textContent = ''; msg.className = 'auth-hint'; }
        if (window.PlatformApi) window.PlatformApi.resolveLogin(true);
        closeAuthPanel();
        updateAuthBadge();
      } else {
        if (msg) { msg.textContent = (d && d.message) || '登录失败'; msg.className = 'auth-hint err'; }
        btn.disabled = false; btn.textContent = '登录';
        loadCaptcha();
      }
    } catch (e) {
      if (msg) { msg.textContent = (e && e.message) || '登录失败'; msg.className = 'auth-hint err'; }
      btn.disabled = false; btn.textContent = '登录';
      loadCaptcha();
    }
  }

  function syncPlatformLogin() {
    var msg = el('authMsg');
    var btn = el('authSyncBtn'); btn.disabled = true; btn.textContent = '同步中...';
    chrome.runtime.sendMessage({ type: 'SYNC_PLATFORM_TOKEN' }, async function (resp) {
      btn.disabled = false; btn.textContent = '同步平台登录态';
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        if (msg) { msg.textContent = (resp && resp.error) || '未找到已登录的平台页面，请先登录平台'; msg.className = 'auth-hint err'; }
        return;
      }
      if (!resp.token) {
        if (msg) { msg.textContent = '平台页面中未检测到登录态'; msg.className = 'auth-hint err'; }
        return;
      }
      var exp = window.PlatformAuth.parseExp(resp.token);
      var boundUrl = currentBaseUrl();
      var user = null;
      try { user = resp.user ? JSON.parse(resp.user) : null; } catch (e2) {}
      await window.PlatformAuth.set({ token: resp.token, user: user, exp: exp, boundUrl: boundUrl });
      if (msg) { msg.textContent = ''; msg.className = 'auth-hint'; }
      if (window.PlatformApi) window.PlatformApi.resolveLogin(true);
      closeAuthPanel();
      updateAuthBadge();
    });
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
      console.log('[AutoTest][doPush] macroActions from storage:', macroActions.length, macroActions.length > 0 ? macroActions[0] : '(empty)');

      // Phase 5: Group by bizOperTraceId
      var groups = {};
      var ungrouped = [];
      list.forEach(function(a, i) {
        var traceId = a.bizOperTraceId || '';
        if (traceId) {
          if (!groups[traceId]) groups[traceId] = { traceId: traceId, apis: [], triggerEvent: a.triggerEvent || 'auto', pageUrl: a.pageUrl || '' };
          groups[traceId].apis.push(a);
        } else {
          ungrouped.push(a);
        }
      });

      var traceKeys = Object.keys(groups);
      var totalGroups = traceKeys.length + (ungrouped.length > 0 ? 1 : 0);

      function buildInterfaceList(apis) {
        return apis.map(function(a, i) {
          return {
            nodeName: a.nodeName || getName(a.url),
            method: a.method || 'GET',
            url: a.url,
            headers: a.headers ? JSON.stringify(a.headers) : '',
            bodyData: a.body || '',
            responseData: typeof a.response === 'string' ? a.response : JSON.stringify(a.response || ''),
            sort: i + 1,
            parallelGroup: '',
            bizOperTraceId: a.bizOperTraceId || '',
            triggerEvent: a.triggerEvent || 'auto',
            targetDom: a.targetDom || '',
            pageUrl: a.pageUrl || '',
            windowId: a.windowId || '',
            isIgnored: a.ignore || false
          };
        });
      }

      function pushGroup(ifList, chainName) {
        var path = '/api/plugin/chain/' + (mode === 'create' ? 'create' : 'append');
        var body = mode === 'create'
          ? { chainName: chainName, interfaceList: ifList }
          : { chainCode: code, interfaceList: ifList };
        return window.PlatformApi.apiFetch(path, { method: 'POST', body: body });
      }

      if (totalGroups <= 1) {
        // Single group or no groups - push as one chain
        var ifList = buildInterfaceList(list);
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
        pushGroup(ifList, name).then(function(d) {
          if (d.code === 200) {
            var chainCode = d.data.chainCode || code;
            el('pushDialog').classList.remove('open');
            var platformUrl = (getConfig().FRONTEND_URL || 'http://localhost:9094') + '/chain/edit/' + chainCode;
            if (confirm('推送成功！链路编码: ' + chainCode + '\n\n是否跳转到平台查看？')) {
              window.open(platformUrl, '_blank');
            }
          } else {
            alert('失败: ' + (d.message || ''));
          }
        }).catch(function(e) { alert('失败: ' + e.message); });
      } else {
        // Multiple trace groups - push each as separate chain
        var pushed = 0, failed = 0;
        var allCodes = [];

        function pushNext(idx) {
          if (idx >= traceKeys.length) {
            // Push ungrouped nodes last
            if (ungrouped.length > 0) {
              var ungroupedList = buildInterfaceList(ungrouped);
              pushGroup(ungroupedList, name + '_未分组').then(function(d) {
                finishPush(d, '_未分组');
              }).catch(function() { failed++; checkDone(); });
            } else {
              checkDone();
            }
            return;
          }
          var key = traceKeys[idx];
          var group = groups[key];
          var groupList = buildInterfaceList(group.apis);
          var suffix = '_' + (group.triggerEvent || 'auto') + '_' + key.substring(4, 12);
          pushGroup(groupList, name + suffix).then(function(d) {
            finishPush(d, suffix);
            pushNext(idx + 1);
          }).catch(function() { failed++; checkDone(); pushNext(idx + 1); });
        }

        function finishPush(d, suffix) {
          if (d.code === 200) {
            pushed++;
            allCodes.push(d.data.chainCode);
          } else {
            failed++;
          }
          checkDone();
        }

        function checkDone() {
          if (pushed + failed >= totalGroups) {
            el('pushDialog').classList.remove('open');
            if (pushed > 0) {
              var msg = '推送完成！成功 ' + pushed + ' 条';
              if (failed > 0) msg += '，失败 ' + failed + ' 条';
              msg += '\n链路编码: ' + allCodes.join(', ');
              if (confirm(msg + '\n\n是否跳转到平台查看？')) {
                window.open((getConfig().FRONTEND_URL || 'http://localhost:9094') + '/chain/list', '_blank');
              }
            } else {
              alert('全部推送失败');
            }
          }
        }

        pushNext(0);
      }
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

  // ========== Hide Panel ==========
  function hidePanel() {
    var app = document.querySelector('.app');
    app.classList.add('slide-out');
    setTimeout(function() {
      chrome.runtime.sendMessage({ type: 'HIDE_SIDE_PANEL' });
    }, 250);
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
