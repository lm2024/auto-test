// ========== API 文档查看器（双模式） ==========
// 模式1 extension：作为插件扩展页打开，从 chrome.storage.local['docViewerData'] 读取
// 模式2 standalone：下载后的自包含 HTML（本地文件打开），从内联 #docData JSON 读取
(function () {
  var MODE = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ? 'extension' : 'standalone';
  var DATA = null;
  var $ = function (id) { return document.getElementById(id); };
  var SECTION_LABELS = { body: '请求体', response: '响应体' };

  function esc(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pretty(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
  }
  function isEmpty(v) { return v === undefined || v === null || v === ''; }
  function defaultName(method, path) {
    // 全路径段拼成驼峰命名：/api/category/tree → apiCategoryTree
    var segs = String(path || '').split('?')[0].split('/').filter(Boolean);
    var name = segs.map(function (s) {
      return s.split(/[-_]+/).filter(Boolean).map(function (p) {
        return p.charAt(0).toUpperCase() + p.slice(1);
      }).join('');
    }).join('');
    if (name) name = name.charAt(0).toLowerCase() + name.slice(1);
    return name || (method + ' 接口');
  }
  function safeName(t) {
    return (String(t || 'api-doc').replace(/[\\\/:*?"<>|]/g, '-').trim() || 'api-doc');
  }
  function buildModel() {
    return {
      title: $('docTitle').value.trim() || 'API 接口文档',
      generatedAt: DATA.generatedAt,
      docs: DATA.docs
    };
  }
  function updateMeta() {
    var meta = $('docMeta');
    if (!meta) return;
    meta.textContent = '生成时间: ' + (DATA.generatedAt || '') + ' · 接口数量: ' + DATA.docs.length + ' · 点击标题/名称可修改，入参返参默认收起';
  }

  // ========== 渲染 ==========
  function sectionHtml(di, ei, key, open) {
    var ex = DATA.docs[di].examples[ei];
    var v = ex[key];
    var cls = 'sec' + (open ? ' open' : '') + (isEmpty(v) ? ' empty-sec' : '');
    var cnt = isEmpty(v) ? '· 无' : (open ? '· 收起' : '· 点击展开');
    return '<div class="' + cls + '" data-di="' + di + '" data-ei="' + ei + '" data-key="' + key + '">'
      + '<div class="sec-h" data-action="toggle-section">'
      + '<span class="chev">▶</span><span class="lbl">' + SECTION_LABELS[key] + '</span><span class="cnt">' + cnt + '</span>'
      + '<button class="edit-btn" data-action="edit-start">编辑</button>'
      + '</div><div class="sec-b">'
      + '<div class="code">' + (isEmpty(v) ? '（无数据，可点「编辑」手动补充）' : esc(pretty(v))) + '</div>'
      + '<div class="edit-wrap"><textarea class="ta" spellcheck="false"></textarea>'
      + '<div class="edit-ops"><button class="save-btn" data-action="edit-save">保存</button>'
      + '<button class="cancel-btn" data-action="edit-cancel">取消</button><span class="edit-err"></span></div>'
      + '</div></div></div>';
  }

  function cardHtml(di) {
    var doc = DATA.docs[di];
    var h = '<div class="card" data-di="' + di + '">'
      + '<div class="card-h">'
      + '<span class="m m-' + esc(doc.method) + '">' + esc(doc.method) + '</span>'
      + '<input class="name-input" data-di="' + di + '" value="' + esc(doc.name || defaultName(doc.method, doc.path)) + '" spellcheck="false" title="点击修改接口名称" />'
      + '<span class="path">' + esc(doc.path) + '</span>'
      + '<span class="base">' + esc(doc.baseUrl) + '</span>'
      + '<button class="del-card" data-action="del-card" title="删除该接口">✕</button>'
      + '</div><div class="card-b">';
    var exCount = (doc.examples || []).length;
    (doc.examples || []).forEach(function (ex, ei) {
      // 仅同一接口有多条录制记录时才显示记录头，单条记录不显示，避免噪音
      if (exCount > 1) {
        h += '<div class="example-h"><b>调用记录 ' + (ei + 1) + '</b>'
          + '<button class="del-ex" data-action="del-example" data-di="' + di + '" data-ei="' + ei + '" title="删除该条调用记录">✕</button></div>';
      }
      h += sectionHtml(di, ei, 'body', false);
      h += sectionHtml(di, ei, 'response', false);
    });
    h += '</div></div>';
    return h;
  }

  function render() {
    var body = $('docBody');
    var tip = $('emptyTip');
    if (!body) return;
    if (!DATA || !DATA.docs || DATA.docs.length === 0) {
      body.innerHTML = '';
      if (tip) tip.style.display = 'block';
      updateMeta();
      return;
    }
    if (tip) tip.style.display = 'none';
    var html = '';
    DATA.docs.forEach(function (d, di) { html += cardHtml(di); });
    body.innerHTML = html;
    updateMeta();
  }

  function renderSection(di, ei, key, open) {
    var root = document.querySelector('.sec[data-di="' + di + '"][data-ei="' + ei + '"][data-key="' + key + '"]');
    if (!root) return;
    root.outerHTML = sectionHtml(di, ei, key, open);
  }

  // ========== 编辑 ==========
  function startEdit(root) {
    var di = +root.getAttribute('data-di'), ei = +root.getAttribute('data-ei'), key = root.getAttribute('data-key');
    var ex = DATA.docs[di].examples[ei];
    root.classList.add('editing');
    var ta = root.querySelector('.ta');
    if (ta) ta.value = pretty(ex[key]);
    var err = root.querySelector('.edit-err');
    if (err) err.textContent = '';
  }
  function cancelEdit(root) {
    var di = +root.getAttribute('data-di'), ei = +root.getAttribute('data-ei'), key = root.getAttribute('data-key');
    root.classList.remove('editing');
    renderSection(di, ei, key, root.classList.contains('open'));
  }
  function saveEdit(root) {
    var di = +root.getAttribute('data-di'), ei = +root.getAttribute('data-ei'), key = root.getAttribute('data-key');
    var ex = DATA.docs[di].examples[ei];
    var ta = root.querySelector('.ta');
    var err = root.querySelector('.edit-err');
    var txt = ta ? ta.value : '';
    var trimmed = txt.trim();
    if (trimmed === '') {
      ex[key] = '';
    } else {
      var orig = ex[key];
      if (typeof orig === 'object' && orig !== null) {
        // 原值是对象/数组：必须仍是合法 JSON
        try { ex[key] = JSON.parse(trimmed); }
        catch (e) { if (err) { err.textContent = 'JSON 格式错误，请检查后重试'; } return; }
      } else {
        // 原值是纯文本：尝试按 JSON 解析，失败则保留原文
        try { ex[key] = JSON.parse(trimmed); }
        catch (e2) { ex[key] = txt; }
      }
    }
    if (err) err.textContent = '';
    renderSection(di, ei, key, true);
  }
  function delExample(di, ei) {
    if (!confirm('确定删除「' + (DATA.docs[di].name || defaultName(DATA.docs[di].method, DATA.docs[di].path)) + '」的调用记录 ' + (ei + 1) + ' 吗？')) return;
    DATA.docs[di].examples.splice(ei, 1);
    if (DATA.docs[di].examples.length === 0) {
      DATA.docs.splice(di, 1);
    }
    render();
  }
  function delCard(di) {
    if (!confirm('确定删除该接口「' + (DATA.docs[di].name || defaultName(DATA.docs[di].method, DATA.docs[di].path)) + '」吗？')) return;
    DATA.docs.splice(di, 1);
    render();
  }

  // ========== 事件 ==========
  function bindDocBody() {
    var body = $('docBody');
    if (!body) return;
    body.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== body && !t.getAttribute('data-action')) { t = t.parentNode; }
      if (!t || t === body) return;
      var action = t.getAttribute('data-action');
      var sec = t.closest('.sec');
      if (action === 'toggle-section') {
        if (t.closest('.edit-btn')) return;
        if (sec) {
          sec.classList.toggle('open');
          var cnt = sec.querySelector('.cnt');
          var key = sec.getAttribute('data-key');
          var di = +sec.getAttribute('data-di'), ei = +sec.getAttribute('data-ei');
          var v = DATA.docs[di].examples[ei][key];
          if (cnt) cnt.textContent = isEmpty(v) ? '· 无' : (sec.classList.contains('open') ? '· 收起' : '· 点击展开');
        }
      } else if (action === 'edit-start' && sec) {
        e.stopPropagation();
        startEdit(sec);
      } else if (action === 'edit-save' && sec) {
        e.stopPropagation();
        saveEdit(sec);
      } else if (action === 'edit-cancel' && sec) {
        e.stopPropagation();
        cancelEdit(sec);
      } else if (action === 'del-example') {
        delExample(+t.getAttribute('data-di'), +t.getAttribute('data-ei'));
      } else if (action === 'del-card') {
        delCard(+t.closest('.card').getAttribute('data-di'));
      }
    });
    body.addEventListener('change', function (e) {
      if (e.target.classList && e.target.classList.contains('name-input')) {
        var di = +e.target.getAttribute('data-di');
        if (DATA.docs[di]) DATA.docs[di].name = e.target.value.trim();
      }
    });
  }

  // ========== 下载 ==========
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function getPageCss() {
    var st = document.querySelector('style');
    return st ? st.textContent : '';
  }
  function getAppJs(cb) {
    if (MODE === 'extension') {
      fetch(chrome.runtime.getURL('doc-viewer.js')).then(function (r) { return r.text(); }).then(cb).catch(function () { cb(''); });
    } else {
      var s = document.getElementById('docApp');
      cb(s ? s.textContent : '');
    }
  }
  var TOOLBAR_HTML = ''
    + '<div class="toolbar"><div class="t-left">'
    + '<input id="docTitle" class="title-input" value="" spellcheck="false" />'
    + '<div id="docMeta" class="meta"></div>'
    + '</div><div class="t-right">'
    + '<button id="btnDownloadHtml" class="btn primary">下载 HTML</button>'
    + '<button id="btnDownloadMd" class="btn">下载 Markdown</button>'
    + '<button id="btnPrint" class="btn">打印</button>'
    + '</div></div>';

  function downloadHtml() {
    var model = buildModel();
    getAppJs(function (jsSrc) {
      var json = JSON.stringify(model).replace(/</g, '\\u003c');
      var js = String(jsSrc || '').replace(/<\/script>/gi, '<\\/script>');
      var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        + '<title>' + esc(model.title) + '</title>'
        + '<style>' + getPageCss() + '</style></head><body>'
        + TOOLBAR_HTML
        + '<div id="docBody" class="doc-body"></div>'
        + '<div id="emptyTip" class="empty" style="display:none">没有接口数据</div>'
        + '<script id="docData" type="application/json">' + json + '<\/script>'
        + '<script id="docApp">' + js + '<\/script>'
        + '</body></html>';
      download(safeName(model.title) + '.html', html, 'text/html;charset=utf-8');
    });
  }

  function mdBlock(v) {
    if (isEmpty(v)) return '（无）';
    if (typeof v === 'string') return '```text\n' + v + '\n```';
    try { return '```json\n' + JSON.stringify(v, null, 2) + '\n```'; }
    catch (e) { return '```text\n' + String(v) + '\n```'; }
  }
  function downloadMarkdown() {
    var model = buildModel();
    var md = '# ' + model.title + '\n\n'
      + '> 生成时间: ' + (model.generatedAt || '') + ' · 接口数量: ' + model.docs.length + '\n\n';
    model.docs.forEach(function (d, i) {
      md += '## ' + d.method + ' ' + d.path + '\n\n';
      md += '- 接口名称: ' + (d.name || defaultName(d.method, d.path)) + '\n';
      md += '- Base URL: ' + (d.baseUrl || '') + '\n\n';
      var exN = (d.examples || []).length;
      (d.examples || []).forEach(function (ex, ei) {
        if (exN > 1) md += '### 调用记录 ' + (ei + 1) + '\n\n';
        md += '**请求体**\n\n' + mdBlock(ex.body) + '\n\n';
        md += '**响应体**\n\n' + mdBlock(ex.response) + '\n\n';
      });
    });
    download(safeName(model.title) + '.md', md, 'text/markdown;charset=utf-8');
  }

  // ========== 初始化 ==========
  function init() {
    $('docTitle').value = DATA.title || 'API 接口文档';
    bindDocBody();
    $('btnDownloadHtml').addEventListener('click', downloadHtml);
    $('btnDownloadMd').addEventListener('click', downloadMarkdown);
    $('btnPrint').addEventListener('click', function () { window.print(); });
    render();
  }
  function showEmpty() {
    $('docTitle').value = 'API 接口文档';
    var tip = $('emptyTip');
    if (tip) tip.style.display = 'block';
    updateMeta();
    bindDocBody();
  }

  if (MODE === 'extension') {
    chrome.storage.local.get(['docViewerData'], function (r) {
      if (r && r.docViewerData) { DATA = r.docViewerData; init(); } else { showEmpty(); }
    });
  } else {
    var elData = document.getElementById('docData');
    if (elData) { try { DATA = JSON.parse(elData.textContent); } catch (e) { DATA = null; } }
    if (DATA) { init(); } else { showEmpty(); }
  }
})();
