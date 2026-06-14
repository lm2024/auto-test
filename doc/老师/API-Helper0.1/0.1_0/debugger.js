// API Debugger - Injected into page for debugging APIs

(function() {
  'use strict';

  // Prevent duplicate injection
  if (window.__apiDebuggerInjected) {
    return;
  }
  window.__apiDebuggerInjected = true;

  // Create debugger UI
  function createDebuggerUI() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'api-debugger-overlay';
    overlay.onclick = closeDebugger;

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'api-debugger-sidebar';
    sidebar.innerHTML = `
      <div id="api-debugger-header">
        <h2>🔧 API 调试器</h2>
        <button id="api-debugger-close">×</button>
      </div>
      <div id="api-debugger-content">
        <!-- Request URL - Required, always visible -->
        <div class="api-debug-section required">
          <div class="api-debug-section-header">
            <div class="api-debug-section-title">请求地址</div>
          </div>
          <div class="api-debug-section-content">
            <input type="text" class="api-debug-input" id="api-debug-url" placeholder="https://api.example.com/endpoint">
          </div>
        </div>

        <!-- Request Method - Collapsible -->
        <div class="api-debug-section" data-section="method">
          <div class="api-debug-section-header">
            <div class="api-debug-section-title">请求方法</div>
            <span class="api-debug-collapse-icon">▼</span>
          </div>
          <div class="api-debug-section-content">
            <select class="api-debug-select" id="api-debug-method">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        </div>

        <!-- Query Parameters - Collapsible -->
        <div class="api-debug-section" data-section="params">
          <div class="api-debug-section-header">
            <div class="api-debug-section-title">查询参数</div>
            <span class="api-debug-collapse-icon">▼</span>
          </div>
          <div class="api-debug-section-content">
            <div id="api-debug-query-params"></div>
            <button class="api-debug-add-btn" id="api-debug-add-param">+ 添加参数</button>
          </div>
        </div>

        <!-- Request Headers - Collapsible, default collapsed -->
        <div class="api-debug-section collapsed" data-section="headers">
          <div class="api-debug-section-header">
            <div class="api-debug-section-title">请求头</div>
            <span class="api-debug-collapse-icon">▼</span>
          </div>
          <div class="api-debug-section-content">
            <div id="api-debug-headers"></div>
            <button class="api-debug-add-btn" id="api-debug-add-header">+ 添加请求头</button>
          </div>
        </div>

        <!-- Request Body - Collapsible -->
        <div class="api-debug-section" data-section="body">
          <div class="api-debug-section-header">
            <div class="api-debug-section-title">请求体 (JSON)</div>
            <span class="api-debug-collapse-icon">▼</span>
          </div>
          <div class="api-debug-section-content">
            <textarea class="api-debug-textarea" id="api-debug-body" placeholder='{"key": "value"}'></textarea>
          </div>
        </div>

        <!-- Send Button -->
        <button class="api-debug-send-btn" id="api-debug-send">
          🚀 发送请求
        </button>

        <!-- Response Section -->
        <div class="api-debug-response" id="api-debug-response">
          <div class="api-debug-section-title" style="margin-bottom: 10px;">响应结果</div>
          <div class="api-debug-response-header">
            <div>
              <span class="api-debug-response-status" id="api-debug-response-status"></span>
              <span class="api-debug-duration" id="api-debug-duration"></span>
            </div>
            <button class="api-debug-copy-btn" id="api-debug-copy">📋 复制</button>
          </div>
          <div class="api-debug-response-body">
            <pre id="api-debug-response-body"></pre>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sidebar);

    // Bind events
    document.getElementById('api-debugger-close').onclick = closeDebugger;
    document.getElementById('api-debug-add-param').onclick = () => addQueryParam();
    document.getElementById('api-debug-add-header').onclick = () => addHeader();
    document.getElementById('api-debug-send').onclick = sendRequest;
    document.getElementById('api-debug-copy').onclick = copyResponse;

    // Bind collapse/expand events
    document.querySelectorAll('.api-debug-section-header').forEach(header => {
      header.addEventListener('click', function() {
        const section = this.closest('.api-debug-section');
        // Don't toggle if it's a required section
        if (!section.classList.contains('required')) {
          section.classList.toggle('collapsed');
        }
      });
    });
  }

  // Load request data into form
  function loadRequestData(data) {
    // Parse URL to separate base URL and query params
    let baseUrl = data.url;
    let queryParams = {};

    try {
      const urlObj = new URL(data.url);
      baseUrl = urlObj.origin + urlObj.pathname;
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
    } catch (e) {
      console.warn('Failed to parse URL:', e);
    }

    // Set URL and method
    document.getElementById('api-debug-url').value = baseUrl;
    document.getElementById('api-debug-method').value = data.method || 'GET';

    // Clear and populate query params
    const queryParamsContainer = document.getElementById('api-debug-query-params');
    queryParamsContainer.innerHTML = '';
    Object.entries(queryParams).forEach(([key, value]) => {
      addQueryParam(key, value);
    });

    // Clear and populate headers
    const headersContainer = document.getElementById('api-debug-headers');
    headersContainer.innerHTML = '';
    if (data.headers && Object.keys(data.headers).length > 0) {
      Object.entries(data.headers).forEach(([key, value]) => {
        addHeader(key, value);
      });
    } else if (data.requestHeaders && Object.keys(data.requestHeaders).length > 0) {
      Object.entries(data.requestHeaders).forEach(([key, value]) => {
        addHeader(key, value);
      });
    } else {
      // Add default Content-Type for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(data.method)) {
        addHeader('Content-Type', 'application/json');
      }
    }

    // Set request body
    const bodyTextarea = document.getElementById('api-debug-body');
    const requestBody = data.body || data.requestBody;
    if (requestBody) {
      bodyTextarea.value = typeof requestBody === 'string'
        ? requestBody
        : JSON.stringify(requestBody, null, 2);
    } else {
      bodyTextarea.value = '';
    }

    // Hide previous response
    document.getElementById('api-debug-response').classList.remove('show');
  }

  // Open debugger with data
  function openDebugger(data) {
    const overlay = document.getElementById('api-debugger-overlay');
    const sidebar = document.getElementById('api-debugger-sidebar');

    if (!overlay || !sidebar) {
      createDebuggerUI();
    }

    // Load request data into form
    loadRequestData(data);

    // Show debugger
    document.getElementById('api-debugger-overlay').classList.add('show');
    document.getElementById('api-debugger-sidebar').classList.add('show');
  }

  // Close debugger
  function closeDebugger() {
    document.getElementById('api-debugger-overlay')?.classList.remove('show');
    document.getElementById('api-debugger-sidebar')?.classList.remove('show');
  }

  // Add query parameter row
  function addQueryParam(key = '', value = '') {
    const container = document.getElementById('api-debug-query-params');
    const id = 'qp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const row = document.createElement('div');
    row.className = 'api-debug-key-value';
    row.id = id;
    row.innerHTML = `
      <input type="text" class="api-debug-input" placeholder="参数名" value="${escapeHtml(key)}">
      <input type="text" class="api-debug-input" placeholder="参数值" value="${escapeHtml(value)}">
      <button class="api-debug-remove-btn">×</button>
    `;

    row.querySelector('button').onclick = () => row.remove();
    container.appendChild(row);
  }

  // Add header row
  function addHeader(key = '', value = '') {
    const container = document.getElementById('api-debug-headers');
    const id = 'hdr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const row = document.createElement('div');
    row.className = 'api-debug-key-value';
    row.id = id;
    row.innerHTML = `
      <input type="text" class="api-debug-input" placeholder="Header名" value="${escapeHtml(key)}">
      <input type="text" class="api-debug-input" placeholder="Header值" value="${escapeHtml(value)}">
      <button class="api-debug-remove-btn">×</button>
    `;

    row.querySelector('button').onclick = () => row.remove();
    container.appendChild(row);
  }

  // Send request
  async function sendRequest() {
    const sendBtn = document.getElementById('api-debug-send');
    const responseDiv = document.getElementById('api-debug-response');
    const responseStatus = document.getElementById('api-debug-response-status');
    const responseDuration = document.getElementById('api-debug-duration');
    const responseBody = document.getElementById('api-debug-response-body');

    // Disable button
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ 发送中...';

    try {
      // Get base URL
      let url = document.getElementById('api-debug-url').value.trim();
      if (!url) {
        alert('请输入请求地址');
        return;
      }

      // Build query params
      const queryParamRows = document.querySelectorAll('#api-debug-query-params .api-debug-key-value');
      const queryParams = new URLSearchParams();
      queryParamRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const key = inputs[0].value.trim();
        const value = inputs[1].value.trim();
        if (key) {
          queryParams.append(key, value);
        }
      });

      // Append query params to URL
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }

      // Get method
      const method = document.getElementById('api-debug-method').value;

      // Build headers
      const headerRows = document.querySelectorAll('#api-debug-headers .api-debug-key-value');
      const headers = {};
      headerRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const key = inputs[0].value.trim();
        const value = inputs[1].value.trim();
        if (key) {
          headers[key] = value;
        }
      });

      // Build request options
      const options = {
        method: method,
        headers: headers
      };

      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const bodyText = document.getElementById('api-debug-body').value.trim();
        if (bodyText) {
          options.body = bodyText;
        }
      }

      // Send request
      const startTime = Date.now();
      const response = await fetch(url, options);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Get response body
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          responseData = text;
        }
      } else {
        responseData = await response.text();
      }

      // Display response
      const statusClass = response.ok ? 'api-debug-status-success' : 'api-debug-status-error';
      responseStatus.textContent = `${response.status} ${response.statusText}`;
      responseStatus.className = 'api-debug-response-status ' + statusClass;
      responseDuration.textContent = `⏱️ ${duration}ms`;

      // Format response body
      const formattedBody = typeof responseData === 'string'
        ? responseData
        : JSON.stringify(responseData, null, 2);

      responseBody.textContent = formattedBody;

      // Show response
      responseDiv.classList.add('show');

      // Success feedback
      sendBtn.textContent = '✓ 请求成功';
      setTimeout(() => {
        sendBtn.textContent = '🚀 发送请求';
      }, 2000);

    } catch (error) {
      console.error('Request failed:', error);

      responseStatus.textContent = '❌ 请求失败';
      responseStatus.className = 'api-debug-response-status api-debug-status-error';
      responseDuration.textContent = '';
      responseBody.textContent = error.message;
      responseDiv.classList.add('show');

      sendBtn.textContent = '✗ 请求失败';
      setTimeout(() => {
        sendBtn.textContent = '🚀 发送请求';
      }, 2000);
    } finally {
      sendBtn.disabled = false;
    }
  }

  // Copy response
  function copyResponse() {
    const responseBody = document.getElementById('api-debug-response-body');
    const text = responseBody.textContent;
    const copyBtn = document.getElementById('api-debug-copy');

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓ 已复制';
        setTimeout(() => {
          copyBtn.textContent = '📋 复制';
        }, 2000);
      }).catch(err => {
        console.error('Clipboard API failed, trying fallback:', err);
        fallbackCopy(text, copyBtn);
      });
    } else {
      // Fallback for older browsers or restricted contexts
      fallbackCopy(text, copyBtn);
    }
  }

  // Fallback copy method using textarea
  function fallbackCopy(text, copyBtn) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);

    try {
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const successful = document.execCommand('copy');

      if (successful) {
        copyBtn.textContent = '✓ 已复制';
        setTimeout(() => {
          copyBtn.textContent = '📋 复制';
        }, 2000);
      } else {
        copyBtn.textContent = '✗ 失败';
        setTimeout(() => {
          copyBtn.textContent = '📋 复制';
        }, 2000);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      copyBtn.textContent = '✗ 失败';
      setTimeout(() => {
        copyBtn.textContent = '📋 复制';
      }, 2000);
    } finally {
      document.body.removeChild(textarea);
    }
  }

  // Helper function for escaping HTML
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
      unsafe = String(unsafe);
    }
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Listen for messages from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) {
      return;
    }

    if (event.data && event.data.type === 'OPEN_API_DEBUGGER') {
      openDebugger(event.data.data);
    }
  });

  // Expose close function for external use
  window.__closeApiDebugger = closeDebugger;

  console.log('API Debugger injected successfully');
})();
