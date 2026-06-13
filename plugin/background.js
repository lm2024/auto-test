let isRecording = false;

chrome.storage.local.get(['isRecording'], (result) => {
  isRecording = result.isRecording || false;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function updateIcon() {
  const iconPath = isRecording ? 'icons/icon_active.png' : 'icons/icon16.png';
  chrome.action.setIcon({ path: { 16: iconPath, 48: 'icons/icon48.png', 128: 'icons/icon128.png' } }).catch(() => {});
}

// 广播消息到所有标签页的 content script
function broadcast(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_RECORDING') {
    isRecording = true;
    chrome.storage.local.set({ isRecording: true });
    updateIcon();
    // 关键：广播给所有 content script
    broadcast({ type: 'START_RECORDING' });
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_RECORDING') {
    isRecording = false;
    chrome.storage.local.set({ isRecording: false });
    updateIcon();
    broadcast({ type: 'STOP_RECORDING' });
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATUS') {
    sendResponse({ isRecording });
  } else if (msg.type === 'SAVE_API') {
    saveApi(msg.data);
    sendResponse({ ok: true });
  } else if (msg.type === 'CLEAR_APIS') {
    chrome.storage.local.set({ recordedApis: [] });
    sendResponse({ ok: true });
  } else if (msg.type === 'DELETE_API') {
    chrome.storage.local.get(['recordedApis'], (result) => {
      const apis = result.recordedApis || [];
      apis.splice(msg.index, 1);
      chrome.storage.local.set({ recordedApis: apis });
      sendResponse({ ok: true });
    });
    return true;
  } else if (msg.type === 'UPDATE_API_NAME') {
    chrome.storage.local.get(['recordedApis'], (result) => {
      const apis = result.recordedApis || [];
      if (apis[msg.index]) { apis[msg.index].nodeName = msg.nodeName; chrome.storage.local.set({ recordedApis: apis }); }
      sendResponse({ ok: true });
    });
    return true;
  }
  return true;
});

function saveApi(data) {
  chrome.storage.local.get(['recordedApis'], (result) => {
    const apis = result.recordedApis || [];
    const dup = apis.some(a => a.url === data.url && a.method === data.method && Math.abs(a.timestamp - data.timestamp) < 2000);
    if (!dup) {
      apis.push(data);
      chrome.storage.local.set({ recordedApis: apis });
    }
  });
}

updateIcon();
