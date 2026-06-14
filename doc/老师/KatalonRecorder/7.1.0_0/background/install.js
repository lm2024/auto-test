function runAutoUpdate() {
  setInterval(async () => {
    const { version, status } = await browser.runtime.requestUpdateCheck();
    if (status === "update_available" && version) {
      const popups = await browser.tabs.query({
        url: browser.runtime.getURL("panel/index.html"),
      });
      if (popups?.length) {
        return;
      }
      await browser.runtime.reload();
    }
  }, 86400000); // 24 hours
}

// KAT-BEGIN show docs on install or upgrade from 1.0
browser.runtime.onInstalled.addListener(function (details) {
  runAutoUpdate();
  if (details.reason === "install") {
    browser.tabs.create({
      url: browser.runtime.getURL("/pages/welcome/welcome.html"),
    });
    trackingInstallApp();
    browser.storage.local.set({ firstTime: true });
  } else if (details.reason === "update") {
    browser.storage.local.set({
      tracking: {
        isUpdated: true,
      },
    });
    // notificationUpdate("Katalon Recorder has been updated", "Find out about new bug fixes and enhancements!");
  }
});

const debounce = function (fn, timeout, c) {
  var d = 0;
  return function (e) {
    clearTimeout(d);
    var f = arguments;
    d = setTimeout(function () {
      fn.apply(c, f);
    }, timeout);
  };
};
const configUninstallUrl = debounce(async () => {
  browser.storage.local.get("segment").then(async function (result) {
    const uninstallUrl = new URL(
      `https://katalon.com/katalon-recorder-ide/tell-us-why`
    );
    if (result.segment) {
      let segment = result.segment;
      uninstallUrl.searchParams.append("userId", segment.userId || "");
      uninstallUrl.searchParams.append("user", segment.user || "");
    }
    const browserIds = await getTrackingBrowserIds();
    uninstallUrl.searchParams.append("browser_name", await getBrowserName());
    Object.entries(browserIds).forEach(([key, value]) => {
      uninstallUrl.searchParams.append(key, value || "");
    });
    browser.runtime.setUninstallURL(uninstallUrl.toString());
  });
}, 1000);

browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message === "open-panel") {
    openPanel(sender.tab, true);
    sendResponse("OK");
    return false;
  }
  if (message === "focus-panel") {
    focusPanel();
    sendResponse("OK");
    return false;
  }
  if (message?.target !== "offscreen-server" && message?.target !== "offscreen") {
    // avoid call getTrackingBrowserIds, getBrowserName leading to infinite loops
    configUninstallUrl();
  }
  return false;
});

// KAT-END

const notify = "Katalon-update";

function notificationUpdate(title, content) {
  browser.notifications.create(notify, {
    type: "basic",
    iconUrl: "/katalon/images/branding/branding_48.png",
    title: title,
    message: content,
  });

  setTimeout(function () {
    browser.notifications.clear(notify);
  }, 5000);
}
