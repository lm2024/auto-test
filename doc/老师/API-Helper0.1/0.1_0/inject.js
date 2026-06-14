(function() {
  const originalFetch = window.fetch;
  const originalXHR = window.XMLHttpRequest;
  
  window.fetch = function(...args) {
    let url = args[0];
    const options = args[1] || {};

    // Convert relative URL to absolute URL
    try {
      url = new URL(url, window.location.href).href;
    } catch (e) {
      // If URL construction fails, use original URL
      console.warn('Failed to construct absolute URL:', e);
    }

    // Capture request body
    let requestBody = null;
    if (options.body) {
      try {
        requestBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (e) {
        requestBody = options.body;
      }
    }

    return originalFetch.apply(this, args).then(response => {
      const clonedResponse = response.clone();

      clonedResponse.text().then(body => {
        try {
          const jsonData = JSON.parse(body);
          window.postMessage({
            type: 'API_REQUEST',
            data: {
              url: url,
              method: options.method || 'GET',
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              requestHeaders: options.headers || {},
              requestBody: requestBody,
              responseBody: jsonData,
              timestamp: Date.now(),
              type: 'fetch'
            }
          }, '*');
        } catch (e) {
          window.postMessage({
            type: 'API_REQUEST',
            data: {
              url: url,
              method: options.method || 'GET',
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              requestHeaders: options.headers || {},
              requestBody: requestBody,
              responseBody: body,
              timestamp: Date.now(),
              type: 'fetch'
            }
          }, '*');
        }
      });

      return response;
    });
  };
  
  const XHROpen = originalXHR.prototype.open;
  originalXHR.prototype.open = function(method, url) {
    this._method = method;

    // Convert relative URL to absolute URL
    try {
      this._url = new URL(url, window.location.href).href;
    } catch (e) {
      // If URL construction fails, use original URL
      console.warn('Failed to construct absolute URL for XHR:', e);
      this._url = url;
    }

    this._requestHeaders = {};
    return XHROpen.apply(this, arguments);
  };

  const XHRSetRequestHeader = originalXHR.prototype.setRequestHeader;
  originalXHR.prototype.setRequestHeader = function(header, value) {
    this._requestHeaders[header] = value;
    return XHRSetRequestHeader.apply(this, arguments);
  };

  const XHRSend = originalXHR.prototype.send;
  originalXHR.prototype.send = function(data) {
    const xhr = this;

    // Capture request body
    let requestBody = null;
    if (data) {
      try {
        requestBody = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (e) {
        requestBody = data;
      }
    }

    xhr.addEventListener('load', function() {
      try {
        let responseData;
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch (e) {
          responseData = xhr.responseText;
        }

        const headers = {};
        const rawHeaders = xhr.getAllResponseHeaders();
        if (rawHeaders) {
          rawHeaders.trim().split(/[\r\n]+/).forEach(line => {
            const parts = line.split(': ');
            if (parts.length >= 2) {
              const key = parts[0];
              const value = parts.slice(1).join(': ');
              headers[key] = value;
            }
          });
        }

        window.postMessage({
          type: 'API_REQUEST',
          data: {
            url: xhr._url,
            method: xhr._method,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: headers,
            requestHeaders: xhr._requestHeaders || {},
            requestBody: requestBody,
            responseBody: responseData,
            timestamp: Date.now(),
            type: 'xhr'
          }
        }, '*');
      } catch (e) {
        console.error('Error capturing XHR request:', e);
      }
    });

    return XHRSend.apply(this, arguments);
  };
})();