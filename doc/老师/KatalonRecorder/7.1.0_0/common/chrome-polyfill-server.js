document.documentElement.setAttribute('katalonExtensionId', chrome.runtime.id);

const transportServer = new PageTransportServer();

transportServer.addConnectionListener((connection) => {
    RemoteObjectHelper.attachToServer(chrome, connection, 'chrome');
});

transportServer.listen();
