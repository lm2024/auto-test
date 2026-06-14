// A map to store the pending promises for each message type
const pendingPromises = {};

// Initialize the message listener once
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen-server") {
    return;
  }

  const { type, data } = message;
  if (pendingPromises[type]) {
    // Resolve the promise with the received data
    pendingPromises[type](data);
    // Remove the resolved promise from the map
    delete pendingPromises[type];
  } else {
    console.warn(`No pending promise for message type: '${type}'`);
  }
});

async function sendMessageToOffscreenDocument(type) {
  await createOffscreenDocument();
  // console.log("Ready to send message to offscreen document.");

  // Create a promise and store its resolver
  const messagePromise = new Promise((resolve) => {
    pendingPromises[type] = resolve;
  });

  chrome.runtime.sendMessage({
    type,
    target: "offscreen",
  });

  // console.log("Waiting for response from offscreen document.");

  const data = await messagePromise;
  // console.log("Received response from offscreen document:", data);
  await closeOffscreenDocument();

  return data;
}

async function createOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: "panel/offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Scrape the DOM to get information.",
    });
  }
}

async function closeOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    return;
  }
  await chrome.offscreen.closeDocument();
  // console.log("Offscreen document closed.");
}

async function hasOffscreenDocument() {
  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    // console.log("hasOffscreenDocument:", Boolean(contexts.length));
    return Boolean(contexts.length);
  } else {
    const matchedClients = await clients.matchAll();
    return await matchedClients.some((client) => {
      client.url.includes(chrome.runtime.id);
    });
  }
}
