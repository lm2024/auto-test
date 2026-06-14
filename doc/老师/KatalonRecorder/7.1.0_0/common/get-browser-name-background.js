function getBrowserName() {
  // console.log("Get browser name in background script.");
  return sendMessageToOffscreenDocument("get-browser-name");
}
