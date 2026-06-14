try {
    importScripts(
        "common/promise-utils.js",
        "background/segment-tracking-services.js",
        "content/bowser.js",
        "common/browser-polyfill.js",
        "common/jwtJsDecode.js",
        "common/browser-fingerprint2.js",
        "common/persistent-store.js",
        "common/get-anonymous-id.js",
        "common/get-browser-fingerprint-background.js",
        "common/get-browser-name-background.js",
        "common/offscreen-server.js",
        "background/background.js",
        "background/install.js",
        "background/kar.js",
        "chrome_variables_init.js",
        "katalon/constants.js",
        "katalon/chrome_variables_default.js",
        "katalon/chrome_common.js",
        "katalon/background.js",
        "panel/js/katalon/papaparse.js"
    );
} catch (e) {
    console.log(e);
}
