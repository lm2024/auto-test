chrome.runtime.onMessage.addListener(handleReceivedMessage);

async function handleReceivedMessage(message) {
  if (message.target !== "offscreen") {
    return false;
  }

  switch (message.type) {
    case "get-browser-name":
      const browserName = getBrowserName(); 
      returnMessage(message.type, browserName);
      break;
    case "get-fingerprint-visitor":
      const visitor = await (await FingerprintJS.load({ region: "ap" })).get();
      returnMessage(message.type, visitor);
      break;
    default:
      console.warn(`Unexpected message type received: "${message.type}".`);
      return false;
  }
}

function returnMessage(type, data) {
  chrome.runtime.sendMessage({
    type,
    target: "offscreen-server",
    data
  });
}
