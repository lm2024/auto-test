let networkRequests = [];
let isRecording = false;

function isDuplicateRequest(newRequest) {
  return networkRequests.some(existingRequest => {
    return existingRequest.method === newRequest.method &&
           existingRequest.url === newRequest.url &&
           JSON.stringify(existingRequest.responseBody) === JSON.stringify(newRequest.responseBody);
  });
}

function shouldCaptureRequest(url) {
  // Filter out chrome extension requests and other internal URLs
  if (!url) return false;

  const urlLower = url.toLowerCase();

  // Exclude patterns
  const excludePatterns = [
    'chrome-extension://',
    'chrome://',
    'edge://',
    'about:',
    'data:',
    'blob:',
    'file://'
  ];

  return !excludePatterns.some(pattern => urlLower.startsWith(pattern));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    isRecording = true;
    networkRequests = [];

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.debugger.attach({tabId: tabId}, "1.2", () => {
          if (chrome.runtime.lastError) {
            console.error('Debugger attach error:', chrome.runtime.lastError);
            sendResponse({status: 'error', message: chrome.runtime.lastError.message});
            return;
          }
          chrome.debugger.sendCommand({tabId: tabId}, "Network.enable", {}, () => {
            if (chrome.runtime.lastError) {
              console.error('Network enable error:', chrome.runtime.lastError);
              sendResponse({status: 'error', message: chrome.runtime.lastError.message});
              return;
            }
            sendResponse({status: 'started'});
          });
        });
      } else {
        sendResponse({status: 'error', message: 'No active tab found'});
      }
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'stopRecording') {
    isRecording = false;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.debugger.detach({tabId: tabId}, () => {
          if (chrome.runtime.lastError) {
            console.error('Debugger detach error:', chrome.runtime.lastError);
          }
          sendResponse({status: 'stopped', requests: networkRequests});
        });
      } else {
        sendResponse({status: 'stopped', requests: networkRequests});
      }
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getRequests') {
    sendResponse({requests: networkRequests, isRecording: isRecording});
  } else if (request.action === 'clearRequests') {
    networkRequests = [];
    sendResponse({status: 'cleared'});
  } else if (request.action === 'generateDocumentation') {
    // Import generateAPIDocumentation and generateDocumentationHTML from popup.js
    // For now, just return the requests and let the panel handle it
    sendResponse({requests: networkRequests});
  } else if (request.type === 'API_REQUEST') {
    // Handle requests from inject.js via content.js
    if (isRecording && shouldCaptureRequest(request.data.url) && !isDuplicateRequest(request.data)) {
      networkRequests.push(request.data);
      chrome.runtime.sendMessage({
        action: 'requestCaptured',
        data: request.data
      }).catch(err => {
        // Popup might be closed, ignore error
        console.log('Could not send to popup:', err);
      });
    }
  }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (isRecording) {
    // Capture request will be sent event to get request details
    if (method === "Network.requestWillBeSent") {
      const requestId = params.requestId;
      const requestData = {
        requestId: requestId,
        url: params.request.url,
        method: params.request.method,
        requestHeaders: params.request.headers,
        requestBody: null,
        timestamp: params.timestamp
      };

      // Try to get POST data if available
      if (params.request.postData) {
        try {
          requestData.requestBody = JSON.parse(params.request.postData);
        } catch (e) {
          requestData.requestBody = params.request.postData;
        }
      }

      // Store temporarily indexed by requestId
      if (!window.tempRequests) window.tempRequests = {};
      window.tempRequests[requestId] = requestData;
    }

    // Capture response received event
    if (method === "Network.responseReceived") {
      // Filter out non-HTTP requests early
      if (!shouldCaptureRequest(params.response.url)) {
        return;
      }

      const requestId = params.requestId;
      const tempRequest = (window.tempRequests && window.tempRequests[requestId]) || {};

      const request = {
        url: params.response.url,
        method: params.response.requestMethod || tempRequest.method,
        status: params.response.status,
        statusText: params.response.statusText,
        headers: params.response.headers,
        requestHeaders: tempRequest.requestHeaders || {},
        requestBody: tempRequest.requestBody || null,
        type: params.type,
        timestamp: params.timestamp || tempRequest.timestamp,
        requestId: requestId
      };

      chrome.debugger.sendCommand(
        {tabId: source.tabId},
        "Network.getResponseBody",
        {requestId: params.requestId},
        (response) => {
          if (response && response.body) {
            try {
              request.responseBody = JSON.parse(response.body);
            } catch (e) {
              request.responseBody = response.body;
            }

            if (!isDuplicateRequest(request)) {
              networkRequests.push(request);

              chrome.runtime.sendMessage({
                action: 'requestCaptured',
                data: request
              }).catch(err => {
                // Popup might be closed, ignore error
                console.log('Could not send to popup:', err);
              });
            }
          }

          // Clean up temp storage
          if (window.tempRequests && window.tempRequests[requestId]) {
            delete window.tempRequests[requestId];
          }
        }
      );
    }
  }
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  // Check if tab URL is valid for content scripts
  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
    // Cannot inject content script in these pages
    // Show a notification or alert
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    return;
  }

  // Send message to content script to open panel
  chrome.tabs.sendMessage(tab.id, {
    action: 'openPanel'
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Failed to open panel:', chrome.runtime.lastError.message);
      // Show error badge
      chrome.action.setBadgeText({ text: '✗', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#f44336', tabId: tab.id });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 3000);
    }
  });
});