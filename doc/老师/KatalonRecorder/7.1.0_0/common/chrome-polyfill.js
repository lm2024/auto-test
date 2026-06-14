
const myChrome = {
    runtime: {
        ...chrome.runtime,
        id: document.documentElement.getAttribute('katalonExtensionId'),
    },
    extension: {},
};

const transport = new PageTransport();
const chromeProxy = RemoteObjectHelper.attachToClient(myChrome, transport, 'chrome');

chrome.runtime = chromeProxy.runtime;
chrome.storage = chromeProxy.storage;
chrome.extension = chromeProxy.extension;
