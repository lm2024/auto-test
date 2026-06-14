let isRecording = false;
let requests = [];

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const openPanelLink = document.getElementById('openPanelLink');
  const status = document.getElementById('status');
  const requestCount = document.getElementById('requestCount');
  const requestsList = document.getElementById('requestsList');

  toggleBtn.addEventListener('click', toggleRecording);
  generateBtn.addEventListener('click', generateDocumentation);
  clearBtn.addEventListener('click', clearRequests);
  openPanelLink.addEventListener('click', openPanel);

  loadRequests();
  updateUI();
});

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      alert('无法获取当前标签页');
      return;
    }
    const tabId = tabs[0].id;
    chrome.runtime.sendMessage({action: 'startRecording', tabId: tabId}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Message error:', chrome.runtime.lastError);
        alert('启动录制失败: ' + chrome.runtime.lastError.message);
        return;
      }
      if (response && response.status === 'started') {
        isRecording = true;
        saveRequests();
        updateUI();
      } else if (response && response.status === 'error') {
        alert('启动录制失败: ' + (response.message || '未知错误'));
      }
    });
  });
}

function stopRecording() {
  isRecording = false;

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      alert('无法获取当前标签页');
      saveRequests();
      updateUI();
      return;
    }

    const tabId = tabs[0].id;

    // Send stop message to background (don't wait for response)
    chrome.runtime.sendMessage({action: 'stopRecording', tabId: tabId}, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Stop recording message error (ignoring):', chrome.runtime.lastError.message);
      }
    });

    // Get requests directly from background via getRequests
    setTimeout(() => {
      chrome.runtime.sendMessage({action: 'getRequests'}, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Get requests error:', chrome.runtime.lastError.message);
          // If can't get from background, keep current requests
        } else if (response && response.requests) {
          requests = response.requests;
          console.log('Got requests from background:', requests.length);
        }
        saveRequests();
        updateUI();
      });
    }, 100); // Small delay to ensure background has processed the stop
  });
}

function generateDocumentation() {
  if (requests.length === 0) {
    alert('没有API请求记录，请先录制一些请求！');
    return;
  }

  console.log('Total requests:', requests.length);
  console.log('First request:', requests[0]);

  const mergeUrls = document.getElementById('mergeUrlsCheckbox').checked;
  const doc = generateAPIDocumentation(requests, mergeUrls);

  console.log('Generated API docs:', doc);
  console.log('API docs length:', doc.length);

  if (doc.length === 0) {
    alert('无法生成文档，请检查控制台日志！');
    return;
  }

  const docHtml = generateDocumentationHTML(doc);

  const newTab = window.open('', '_blank');
  newTab.document.write(docHtml);
  newTab.document.close();
}

function generateAPIDocumentation(requests, mergeUrls = true) {
  const groupedRequests = {};

  requests.forEach((request, index) => {
    try {
      // Ensure request has required fields
      if (!request.url) {
        console.warn(`Request ${index} missing URL, skipping`);
        return;
      }

      const url = new URL(request.url);
      const baseUrl = url.origin;
      const path = url.pathname;

      // Use method from request, fallback to 'GET'
      const method = request.method || 'GET';

      // If mergeUrls is true, group by method + path; otherwise include full URL with query params
      const key = mergeUrls
        ? `${method} ${path}`
        : `${method} ${path}${url.search}`;

      if (!groupedRequests[key]) {
        groupedRequests[key] = {
          method: method,
          path: mergeUrls ? path : path + url.search,
          baseUrl: baseUrl,
          examples: []
        };
      }

      groupedRequests[key].examples.push({
        url: request.url,
        method: method,
        status: request.status,
        statusText: request.statusText,
        headers: request.headers,
        requestHeaders: request.requestHeaders,
        requestBody: request.requestBody,
        responseBody: request.responseBody,
        timestamp: request.timestamp
      });
    } catch (e) {
      console.error(`Error processing request ${index}:`, e.message, request);
      // Skip invalid URLs
    }
  });

  console.log('Grouped requests:', groupedRequests);
  return Object.values(groupedRequests);
}

// Convert API request to OpenAPI 3.0 format
function convertToOpenAPI(apiDoc) {
  const example = apiDoc.examples[0]; // Use first example as template
  const url = new URL(example.url);

  // Extract query parameters
  const queryParams = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = {
      schema: { type: typeof value === 'number' ? 'number' : 'string' },
      description: '',
      example: value
    };
  });

  // Parse request body to infer schema
  let requestBodySchema = null;
  if (example.requestBody) {
    try {
      const bodyData = typeof example.requestBody === 'string'
        ? JSON.parse(example.requestBody)
        : example.requestBody;
      requestBodySchema = inferSchema(bodyData);
    } catch (e) {
      requestBodySchema = { type: 'string' };
    }
  }

  // Parse response body to infer schema
  let responseBodySchema = null;
  if (example.responseBody) {
    try {
      const responseData = typeof example.responseBody === 'string'
        ? JSON.parse(example.responseBody)
        : example.responseBody;
      responseBodySchema = inferSchema(responseData);
    } catch (e) {
      responseBodySchema = { type: 'string' };
    }
  }

  // Build OpenAPI path object
  const pathObj = {
    [apiDoc.method.toLowerCase()]: {
      summary: `${apiDoc.method} ${apiDoc.path}`,
      description: `从录制的请求中生成 (共 ${apiDoc.examples.length} 个示例)`,
      parameters: [],
      responses: {}
    }
  };

  // Add query parameters
  Object.entries(queryParams).forEach(([name, param]) => {
    pathObj[apiDoc.method.toLowerCase()].parameters.push({
      name: name,
      in: 'query',
      required: false,
      ...param
    });
  });

  // Add request body if exists
  if (requestBodySchema) {
    pathObj[apiDoc.method.toLowerCase()].requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: requestBodySchema,
          example: example.requestBody
        }
      }
    };
  }

  // Add response
  const statusCode = String(example.status || 200);
  pathObj[apiDoc.method.toLowerCase()].responses[statusCode] = {
    description: example.statusText || 'Successful response',
    content: {
      'application/json': {
        schema: responseBodySchema || { type: 'object' },
        example: example.responseBody
      }
    }
  };

  // Build complete OpenAPI spec for this single endpoint
  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: `从浏览器请求自动生成的API文档`
    },
    servers: [
      {
        url: apiDoc.baseUrl,
        description: '服务器地址'
      }
    ],
    paths: {
      [apiDoc.path]: pathObj
    }
  };

  return openAPISpec;
}

// Infer JSON schema from data
function inferSchema(data) {
  if (data === null) {
    return { type: 'null' };
  }

  const type = Array.isArray(data) ? 'array' : typeof data;

  switch (type) {
    case 'array':
      return {
        type: 'array',
        items: data.length > 0 ? inferSchema(data[0]) : { type: 'object' }
      };

    case 'object':
      const properties = {};
      const required = [];

      Object.entries(data).forEach(([key, value]) => {
        properties[key] = inferSchema(value);
        if (value !== null && value !== undefined) {
          required.push(key);
        }
      });

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };

    case 'number':
      return { type: Number.isInteger(data) ? 'integer' : 'number' };

    case 'boolean':
      return { type: 'boolean' };

    case 'string':
    default:
      return { type: 'string' };
  }
}

function generateDocumentationHTML(apiDocs) {
  const currentDate = new Date().toLocaleString('zh-CN');

  // Helper function to escape HTML
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

  // Helper function to syntax highlight JSON
  function syntaxHighlightJSON(json) {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2);
    }

    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  // Helper function to get raw JSON string for copying
  function getRawJSON(data) {
    if (typeof data === 'string') {
      return data;
    }
    return JSON.stringify(data, null, 2);
  }

  let html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API文档</title>
        <style>
            * {
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1400px;
                margin: 0 auto;
                padding: 30px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }

            .container {
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                overflow: hidden;
            }

            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px;
                text-align: center;
                border-bottom: 4px solid #5568d3;
            }

            .header h1 {
                margin: 0 0 10px 0;
                font-size: 32px;
                font-weight: 700;
                text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            .header-meta {
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-top: 20px;
                font-size: 14px;
                opacity: 0.95;
            }

            .header-meta-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .content {
                padding: 40px;
            }

            .toc {
                background: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 20px;
                margin-bottom: 30px;
                border-radius: 8px;
            }

            .toc h3 {
                margin: 0 0 15px 0;
                color: #667eea;
                font-size: 18px;
            }

            .toc-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .toc-item {
                padding: 8px 0;
                border-bottom: 1px solid #e0e0e0;
            }

            .toc-item:last-child {
                border-bottom: none;
            }

            .toc-link {
                text-decoration: none;
                color: #333;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: color 0.2s;
            }

            .toc-link:hover {
                color: #667eea;
            }

            .api-item {
                background: white;
                margin-bottom: 30px;
                border-radius: 12px;
                border: 1px solid #e0e0e0;
                overflow: hidden;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .api-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }

            .api-header {
                padding: 24px;
                background: linear-gradient(to right, #f8f9fa, #ffffff);
                border-bottom: 2px solid #e9ecef;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .method {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 700;
                font-size: 13px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .method-GET { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
            .method-POST { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
            .method-PUT { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
            .method-DELETE { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
            .method-PATCH { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }

            .path {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 18px;
                color: #1f2937;
                font-weight: 600;
                flex: 1;
                word-break: break-all;
            }

            .api-content {
                padding: 24px;
            }

            .base-url {
                background: #f0f9ff;
                border-left: 4px solid #3b82f6;
                padding: 12px 16px;
                margin-bottom: 20px;
                border-radius: 6px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 14px;
                color: #1e40af;
            }

            .examples-header {
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 16px;
                font-weight: 500;
            }

            .example {
                background: #fafafa;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                margin-bottom: 20px;
                overflow: hidden;
            }

            .example-header {
                background: linear-gradient(to right, #e5e7eb, #f3f4f6);
                padding: 12px 20px;
                font-weight: 600;
                border-bottom: 1px solid #d1d5db;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .example-title {
                font-size: 14px;
                color: #374151;
            }

            .example-content {
                padding: 20px;
            }

            .section {
                margin-bottom: 20px;
            }

            .section-title {
                font-weight: 600;
                color: #374151;
                margin-bottom: 10px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .code-block {
                background: #1f2937;
                color: #e5e7eb;
                border-radius: 6px;
                padding: 16px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                overflow-x: auto;
                line-height: 1.5;
            }

            .code-block a {
                color: #60a5fa;
                text-decoration: none;
            }

            .code-block a:hover {
                text-decoration: underline;
            }

            .status {
                display: inline-flex;
                align-items: center;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                gap: 6px;
            }

            .status::before {
                content: '';
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }

            .status-success {
                background: #d1fae5;
                color: #065f46;
            }

            .status-success::before {
                background: #10b981;
            }

            .status-error {
                background: #fee2e2;
                color: #991b1b;
            }

            .status-error::before {
                background: #ef4444;
            }

            .headers-grid {
                display: grid;
                gap: 8px;
            }

            .header-item {
                background: white;
                padding: 10px 14px;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 12px;
                display: grid;
                grid-template-columns: 200px 1fr;
                gap: 12px;
            }

            .header-key {
                color: #6366f1;
                font-weight: 600;
            }

            .header-value {
                color: #4b5563;
                word-break: break-all;
            }

            .response-body {
                background: #1f2937;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid #374151;
            }

            .response-body-header {
                background: #111827;
                padding: 10px 16px;
                color: #9ca3af;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1px solid #374151;
            }

            .response-body-content {
                padding: 16px;
                max-height: 400px;
                overflow-y: auto;
            }

            .response-body-content::-webkit-scrollbar {
                width: 8px;
            }

            .response-body-content::-webkit-scrollbar-track {
                background: #1f2937;
            }

            .response-body-content::-webkit-scrollbar-thumb {
                background: #4b5563;
                border-radius: 4px;
            }

            .response-body-content::-webkit-scrollbar-thumb:hover {
                background: #6b7280;
            }

            pre {
                margin: 0;
                white-space: pre-wrap;
                word-wrap: break-word;
                color: #e5e7eb;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                line-height: 1.6;
            }

            .timestamp {
                color: #9ca3af;
                font-size: 12px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            }

            /* JSON Syntax Highlighting */
            .json-key {
                color: #60a5fa;
                font-weight: 600;
            }

            .json-string {
                color: #34d399;
            }

            .json-number {
                color: #fbbf24;
            }

            .json-boolean {
                color: #f472b6;
                font-weight: 600;
            }

            .json-null {
                color: #9ca3af;
                font-style: italic;
            }

            /* Copy Button Styles */
            .copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: #374151;
                border: 1px solid #4b5563;
                color: #e5e7eb;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .copy-btn:hover {
                background: #4b5563;
                border-color: #6b7280;
            }

            .copy-btn:active {
                transform: scale(0.95);
            }

            .copy-btn.copied {
                background: #059669;
                border-color: #10b981;
                color: white;
            }

            .copy-openapi-btn {
                background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                border: 1px solid #4f46e5;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-weight: 500;
            }

            .copy-openapi-btn:hover {
                background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }

            .copy-openapi-btn:active {
                transform: scale(0.95);
            }

            .copy-openapi-btn.copied {
                background: linear-gradient(135deg, #059669 0%, #047857 100%);
                border-color: #10b981;
            }

            .code-container {
                position: relative;
            }

            .query-params {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 12px 16px;
                margin: 10px 0;
                border-radius: 6px;
            }

            .query-params-title {
                color: #92400e;
                font-weight: 600;
                font-size: 12px;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .query-param {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 12px;
                color: #78350f;
                padding: 4px 0;
            }

            .param-key {
                color: #92400e;
                font-weight: 600;
            }

            .param-value {
                color: #451a03;
            }

            @media (max-width: 768px) {
                body {
                    padding: 15px;
                }

                .content {
                    padding: 20px;
                }

                .header h1 {
                    font-size: 24px;
                }

                .header-meta {
                    flex-direction: column;
                    gap: 10px;
                }

                .path {
                    font-size: 14px;
                }

                .header-item {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📚 API接口文档</h1>
                <div class="header-meta">
                    <div class="header-meta-item">
                        <span>⏰ 生成时间:</span>
                        <span>${currentDate}</span>
                    </div>
                    <div class="header-meta-item">
                        <span>🔗 接口数量:</span>
                        <span>${apiDocs.length} 个</span>
                    </div>
                </div>
            </div>
            <div class="content">
  `;

  // Generate table of contents
  if (apiDocs.length > 3) {
    html += `
      <div class="toc">
        <h3>📑 目录</h3>
        <ul class="toc-list">
    `;
    apiDocs.forEach((api, index) => {
      html += `
        <li class="toc-item">
          <a href="#api-${index}" class="toc-link">
            <span class="method method-${escapeHtml(api.method)}">${escapeHtml(api.method)}</span>
            <span>${escapeHtml(api.path)}</span>
          </a>
        </li>
      `;
    });
    html += `
        </ul>
      </div>
    `;
  }

  apiDocs.forEach((api, apiIndex) => {
    // Store OpenAPI spec for this API - use data attribute to preserve JSON
    const openAPISpec = convertToOpenAPI(api);
    const openAPIJson = JSON.stringify(openAPISpec, null, 2);
    // Escape for HTML attribute (use single quotes for attribute, escape single quotes in JSON)
    const escapedForAttribute = openAPIJson.replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    html += `
      <div class="api-item" id="api-${apiIndex}">
        <div class="api-header">
          <span class="method method-${escapeHtml(api.method)}">${escapeHtml(api.method)}</span>
          <span class="path">${escapeHtml(api.path)}</span>
          <button class="copy-openapi-btn" onclick="copyOpenAPIToClipboard(${apiIndex}, this)" data-openapi='${escapedForAttribute}' title="复制OpenAPI规范JSON">
            📋 OpenAPI
          </button>
        </div>
        <div class="api-content">
          <div class="base-url">
            <strong>Base URL:</strong> ${escapeHtml(api.baseUrl)}
          </div>
          <p class="examples-header">📊 共捕获 ${api.examples.length} 个请求示例</p>
    `;

    api.examples.forEach((example, index) => {
      const statusClass = example.status >= 200 && example.status < 300 ? 'status-success' : 'status-error';
      const timestamp = example.timestamp ? new Date(example.timestamp).toLocaleString('zh-CN') : '';

      // Parse URL for query params
      let queryParams = {};
      try {
        const urlObj = new URL(example.url);
        urlObj.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });
      } catch (e) {
        // Ignore URL parse errors
      }

      const exampleId = `example-${apiIndex}-${index}`;

      html += `
        <div class="example">
          <div class="example-header">
            <span class="example-title">📝 示例 ${index + 1} - ${escapeHtml(example.method || api.method)}</span>
            <span class="status ${statusClass}">${example.status} ${escapeHtml(example.statusText)}</span>
          </div>
          <div class="example-content">
            <div class="section">
              <div class="section-title">🔗 请求URL</div>
              <div class="code-block">${escapeHtml(example.url)}</div>
            </div>

            ${Object.keys(queryParams).length > 0 ? `
            <div class="section">
              <div class="query-params">
                <div class="query-params-title">🔍 查询参数</div>
                ${Object.entries(queryParams).map(([key, value]) =>
                  `<div class="query-param">
                    <span class="param-key">${escapeHtml(key)}</span>: <span class="param-value">${escapeHtml(value)}</span>
                  </div>`
                ).join('')}
              </div>
            </div>
            ` : ''}

            ${example.requestHeaders && Object.keys(example.requestHeaders).length > 0 ? `
            <div class="section">
              <div class="section-title">📤 请求头</div>
              <div class="headers-grid">
                ${Object.entries(example.requestHeaders).map(([key, value]) =>
                  `<div class="header-item">
                    <span class="header-key">${escapeHtml(key)}</span>
                    <span class="header-value">${escapeHtml(String(value))}</span>
                  </div>`
                ).join('')}
              </div>
            </div>
            ` : ''}

            ${example.requestBody ? `
            <div class="section">
              <div class="section-title">📨 请求体</div>
              <div class="code-container">
                <button class="copy-btn" onclick="copyToClipboard('${exampleId}-request', this)">📋 复制</button>
                <div class="response-body">
                  <div class="response-body-header">Request Body</div>
                  <div class="response-body-content">
                    <pre id="${exampleId}-request" data-raw="${escapeHtml(getRawJSON(example.requestBody))}">${syntaxHighlightJSON(example.requestBody)}</pre>
                  </div>
                </div>
              </div>
            </div>
            ` : ''}

            ${Object.keys(example.headers || {}).length > 0 ? `
            <div class="section">
              <div class="section-title">📥 响应头</div>
              <div class="headers-grid">
                ${Object.entries(example.headers || {}).map(([key, value]) =>
                  `<div class="header-item">
                    <span class="header-key">${escapeHtml(key)}</span>
                    <span class="header-value">${escapeHtml(String(value))}</span>
                  </div>`
                ).join('')}
              </div>
            </div>
            ` : ''}

            <div class="section">
              <div class="section-title">📦 响应体</div>
              <div class="code-container">
                <button class="copy-btn" onclick="copyToClipboard('${exampleId}-response', this)">📋 复制</button>
                <div class="response-body">
                  <div class="response-body-header">Response Body</div>
                  <div class="response-body-content">
                    <pre id="${exampleId}-response" data-raw="${escapeHtml(getRawJSON(example.responseBody))}">${syntaxHighlightJSON(example.responseBody)}</pre>
                  </div>
                </div>
              </div>
            </div>

            ${timestamp ? `<div class="timestamp">⏰ ${timestamp}</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
            </div>
        </div>
        <script>
        function copyToClipboard(elementId, button) {
          const element = document.getElementById(elementId);
          if (!element) {
            console.error('Element not found:', elementId);
            return;
          }

          // Try to get raw data from data-raw attribute first
          let text = element.getAttribute('data-raw');

          // If no data-raw attribute, fall back to text content
          if (!text) {
            text = element.innerText || element.textContent;
          }

          // Copy to clipboard
          navigator.clipboard.writeText(text).then(() => {
            // Update button state
            const originalText = button.innerHTML;
            button.innerHTML = '✓ 已复制';
            button.classList.add('copied');

            // Reset after 2 seconds
            setTimeout(() => {
              button.innerHTML = originalText;
              button.classList.remove('copied');
            }, 2000);
          }).catch(err => {
            console.error('Failed to copy:', err);
            button.innerHTML = '✗ 失败';
            setTimeout(() => {
              button.innerHTML = '📋 复制';
            }, 2000);
          });
        }

        function copyOpenAPIToClipboard(apiIndex, button) {
          try {
            // Get the OpenAPI JSON from data attribute
            const openAPIData = button.getAttribute('data-openapi');
            if (!openAPIData) {
              console.error('No OpenAPI data found for API', apiIndex);
              alert('无法获取OpenAPI数据');
              return;
            }

            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = openAPIData;
            const decodedJson = textarea.value;

            // Copy to clipboard
            navigator.clipboard.writeText(decodedJson).then(() => {
              // Update button state
              const originalText = button.innerHTML;
              button.innerHTML = '✓ 已复制';
              button.classList.add('copied');

              // Reset after 2 seconds
              setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
              }, 2000);
            }).catch(err => {
              console.error('Failed to copy OpenAPI spec:', err);
              button.innerHTML = '✗ 失败';
              setTimeout(() => {
                button.innerHTML = '📋 OpenAPI';
              }, 2000);
            });
          } catch (e) {
            console.error('Error in copyOpenAPIToClipboard:', e);
            alert('复制失败: ' + e.message);
          }
        }
        </script>
    </body>
    </html>
  `;

  return html;
}

function clearRequests() {
  requests = [];
  saveRequests();
  updateUI();
}

function saveRequests() {
  chrome.storage.local.set({requests: requests, isRecording: isRecording});
}

function loadRequests() {
  // First load from storage
  chrome.storage.local.get(['requests', 'isRecording'], function(result) {
    requests = result.requests || [];
    isRecording = result.isRecording || false;

    // Then try to get latest from background
    chrome.runtime.sendMessage({action: 'getRequests'}, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Could not get requests from background:', chrome.runtime.lastError.message);
        // Just use storage data
      } else if (response && response.requests && response.requests.length > 0) {
        // Use background data if it has more requests
        if (response.requests.length > requests.length) {
          requests = response.requests;
          console.log('Updated requests from background:', requests.length);
        }
      }
      updateUI();
    });
  });
}

function updateUI() {
  const status = document.getElementById('status');
  const requestCount = document.getElementById('requestCount');
  const requestsList = document.getElementById('requestsList');
  const toggleBtn = document.getElementById('toggleBtn');

  if (isRecording) {
    status.className = 'status recording';
    status.textContent = '正在录制...';
    toggleBtn.textContent = '停止录制';
    toggleBtn.className = 'btn-stop';
  } else {
    status.className = 'status stopped';
    status.textContent = '已停止录制';
    toggleBtn.textContent = '开始录制';
    toggleBtn.className = 'btn-start';
  }

  requestCount.textContent = requests.length;

  if (requests.length === 0) {
    requestsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无请求记录</div>';
  } else {
    requestsList.innerHTML = requests.slice(-10).reverse().map((request, index) => {
      const actualIndex = requests.length - 1 - index; // Calculate actual index in requests array
      const method = request.method || 'GET';
      const methodClass = `method-${method.toLowerCase()}`;
      const statusClass = request.status >= 200 && request.status < 300 ? 'status-success' : 'status-error';

      try {
        const url = new URL(request.url);
        const displayUrl = url.pathname + url.search;

        return `
          <div class="request-item" data-request-index="${actualIndex}">
            <span class="request-method ${methodClass}">${method}</span>
            <span class="request-url">${displayUrl}</span>
            <span class="request-status ${statusClass}">${request.status}</span>
            <button class="copy-openapi-btn" data-request-index="${actualIndex}">📋</button>
            <button class="debug-request-btn" data-request-index="${actualIndex}">🔧</button>
          </div>
        `;
      } catch (e) {
        console.error('Invalid URL in request:', request.url, e);
        return `
          <div class="request-item" data-request-index="${actualIndex}">
            <span class="request-method ${methodClass}">${method}</span>
            <span class="request-url">${request.url}</span>
            <span class="request-status ${statusClass}">${request.status}</span>
            <button class="copy-openapi-btn" data-request-index="${actualIndex}">📋</button>
            <button class="debug-request-btn" data-request-index="${actualIndex}">🔧</button>
          </div>
        `;
      }
    }).join('');

    // Bind debug button click events
    document.querySelectorAll('.debug-request-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = parseInt(this.getAttribute('data-request-index'));
        openDebugger(requests[index]);
      });
    });

    // Bind OpenAPI copy button click events
    document.querySelectorAll('.copy-openapi-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = parseInt(this.getAttribute('data-request-index'));
        copyOpenAPIFromRequest(requests[index], this);
      });
    });
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'requestCaptured') {
    requests.push(request.data);
    updateUI();
    saveRequests();
  }
});

// Open debugger in current tab
function openDebugger(requestData) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      alert('无法获取当前标签页');
      return;
    }

    const tabId = tabs[0].id;

    // Send message to content script to open debugger
    chrome.tabs.sendMessage(tabId, {
      action: 'openDebugger',
      data: {
        url: requestData.url,
        method: requestData.method || 'GET',
        headers: requestData.requestHeaders || {},
        body: requestData.requestBody || null
      }
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Failed to open debugger:', chrome.runtime.lastError.message);
        alert('无法打开调试器，请刷新页面后重试');
      }
    });
  });
}

// Open panel in current tab
function openPanel() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      alert('无法获取当前标签页');
      return;
    }

    const tab = tabs[0];
    const tabId = tab.id;

    // Check if tab URL is valid for content scripts
    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
      alert('无法在浏览器内置页面中打开侧边面板\n请在普通网页中使用此功能');
      return;
    }

    // Send message to content script to open panel
    chrome.tabs.sendMessage(tabId, {
      action: 'openPanel'
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Failed to open panel:', chrome.runtime.lastError.message);
        alert('无法打开侧边面板\n\n可能的原因：\n1. 页面还未完全加载，请刷新页面后重试\n2. 当前页面不支持扩展注入\n\n错误信息：' + chrome.runtime.lastError.message);
      } else {
        // Close the popup after opening panel
        window.close();
      }
    });
  });
}

// Copy OpenAPI spec from a single request
function copyOpenAPIFromRequest(request, button) {
  try {
    // Create a minimal API doc structure from single request
    const url = new URL(request.url);
    const apiDoc = {
      method: request.method || 'GET',
      path: url.pathname,
      baseUrl: url.origin,
      examples: [{
        url: request.url,
        method: request.method || 'GET',
        status: request.status,
        statusText: request.statusText,
        headers: request.headers,
        requestHeaders: request.requestHeaders,
        requestBody: request.requestBody,
        responseBody: request.responseBody,
        timestamp: request.timestamp
      }]
    };

    // Convert to OpenAPI spec
    const openAPISpec = convertToOpenAPI(apiDoc);
    const openAPIJson = JSON.stringify(openAPISpec, null, 2);

    // Copy to clipboard
    navigator.clipboard.writeText(openAPIJson).then(() => {
      // Update button state
      const originalText = button.innerHTML;
      button.innerHTML = '✓';
      button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

      // Reset after 1.5 seconds
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy OpenAPI spec:', err);
      button.innerHTML = '✗';
      setTimeout(() => {
        button.innerHTML = '📋';
      }, 1500);
    });
  } catch (e) {
    console.error('Error converting request to OpenAPI:', e);
    alert('转换为OpenAPI格式失败: ' + e.message);
  }
}