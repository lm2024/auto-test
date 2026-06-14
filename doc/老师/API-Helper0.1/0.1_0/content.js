// Inject the API interception script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(script);
script.onload = function() {
  script.remove();
};

// Inject panel CSS
const panelCSS = document.createElement('link');
panelCSS.rel = 'stylesheet';
panelCSS.href = chrome.runtime.getURL('panel.css');
(document.head || document.documentElement).appendChild(panelCSS);

// Inject doc generator utilities
const docGenScript = document.createElement('script');
docGenScript.src = chrome.runtime.getURL('doc-generator.js');
(document.head || document.documentElement).appendChild(docGenScript);
docGenScript.onload = function() {
  docGenScript.remove();
};

// Inject panel script
const panelScript = document.createElement('script');
panelScript.src = chrome.runtime.getURL('panel.js');
(document.head || document.documentElement).appendChild(panelScript);
panelScript.onload = function() {
  panelScript.remove();
};

// Inject debugger CSS
const debuggerCSS = document.createElement('link');
debuggerCSS.rel = 'stylesheet';
debuggerCSS.href = chrome.runtime.getURL('debugger.css');
(document.head || document.documentElement).appendChild(debuggerCSS);

// Inject debugger script
const debuggerScript = document.createElement('script');
debuggerScript.src = chrome.runtime.getURL('debugger.js');
(document.head || document.documentElement).appendChild(debuggerScript);
debuggerScript.onload = function() {
  debuggerScript.remove();
};

// Listen for messages from inject.js and panel.js and forward to background
window.addEventListener('message', function(event) {
  // Only accept messages from same origin
  if (event.source !== window) {
    return;
  }

  if (event.data && event.data.type === 'API_REQUEST') {
    // Forward to background script with error handling
    try {
      chrome.runtime.sendMessage(event.data, function(response) {
        // Check if extension context is valid
        if (chrome.runtime.lastError) {
          // Silently ignore - this happens when extension is reloaded
          console.log('Extension context may be invalidated:', chrome.runtime.lastError.message);
        }
      });
    } catch (e) {
      // Silently ignore - extension might be reloading
      console.log('Error sending message to background:', e);
    }
  } else if (event.data && event.data.type === 'API_PANEL_REQUEST') {
    // Forward panel requests to background
    const action = event.data.action;
    const message = {
      action: action,
      mergeUrls: event.data.mergeUrls
    };

    chrome.runtime.sendMessage(message, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Error forwarding panel request:', chrome.runtime.lastError.message);
        return;
      }

      // Send response back to panel
      window.postMessage({
        type: 'API_PANEL_RESPONSE',
        action: action,
        response: response
      }, '*');
    });
  }
});

// Listen for messages from popup/background to open panel or debugger
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'openPanel') {
    // Send message to page context to open panel
    window.postMessage({
      type: 'OPEN_API_PANEL'
    }, '*');
    sendResponse({status: 'ok'});
  } else if (request.action === 'openDebugger') {
    // Send message to page context to open debugger
    window.postMessage({
      type: 'OPEN_API_DEBUGGER',
      data: request.data
    }, '*');
    sendResponse({status: 'ok'});
  } else if (request.action === 'requestCaptured') {
    // Forward to page context to update panel
    window.postMessage({
      type: 'API_REQUEST_CAPTURED',
      data: request.data
    }, '*');
  }
  return true;
});
