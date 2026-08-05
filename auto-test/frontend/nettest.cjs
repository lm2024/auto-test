const https = require('https');
const http = require('http');

function testDirect(url) {
  return new Promise((resolve) => {
    const t = Date.now();
    const req = https.get(url, { timeout: 15000 }, (r) => {
      let n = 0;
      r.on('data', (c) => { n += c.length; });
      r.on('end', () => resolve(`DIRECT ${r.statusCode} ${n}B ${Date.now()-t}ms`));
    });
    req.on('error', (e) => resolve(`DIRECT ERR ${e.message}`));
    req.on('timeout', () => { req.destroy(); resolve('DIRECT TIMEOUT'); });
  });
}

function testProxy(url) {
  return new Promise((resolve) => {
    const t = Date.now();
    const u = new URL(url);
    const req = http.request({
      host: '127.0.0.1', port: 7897, method: 'GET',
      path: url, headers: { Host: u.host }
    });
    req.setTimeout(15000);
    req.on('response', (r) => {
      let n = 0;
      r.on('data', (c) => { n += c.length; });
      r.on('end', () => resolve(`PROXY ${r.statusCode} ${n}B ${Date.now()-t}ms`));
    });
    req.on('error', (e) => resolve(`PROXY ERR ${e.message}`));
    req.on('timeout', () => { req.destroy(); resolve('PROXY TIMEOUT'); });
    req.end();
  });
}

(async () => {
  const url = 'https://registry.npmmirror.com/vue/-/vue-3.4.21.tgz';
  console.log('real tarball url:', url);
  console.log(await testDirect(url));
  console.log(await testProxy(url));
  process.exit(0);
})();
