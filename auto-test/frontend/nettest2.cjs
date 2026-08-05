const https = require('https');
const http = require('http');

function fetchFollow(url, proxy) {
  return new Promise((resolve) => {
    const t = Date.now();
    const doGet = (target, viaProxy, redirectsLeft) => {
      let req;
      if (viaProxy) {
        const u = new URL(target);
        req = http.request({ host: '127.0.0.1', port: 7897, method: 'GET', path: target, headers: { Host: u.host } });
      } else {
        req = https.get(target);
      }
      req.setTimeout(20000);
      req.on('response', (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && redirectsLeft > 0) {
          r.resume();
          const loc = new URL(r.headers.location, target).href;
          return doGet(loc, viaProxy, redirectsLeft - 1);
        }
        let n = 0;
        r.on('data', (c) => { n += c.length; });
        r.on('end', () => resolve(`${viaProxy ? 'PROXY' : 'DIRECT'} final=${r.statusCode} ${n}B ${Date.now()-t}ms`));
      });
      req.on('error', (e) => resolve(`${viaProxy ? 'PROXY' : 'DIRECT'} ERR ${e.message}`));
      req.on('timeout', () => { req.destroy(); resolve(`${viaProxy ? 'PROXY' : 'DIRECT'} TIMEOUT`); });
      req.end();
    };
    doGet(url, proxy, 5);
  });
}

(async () => {
  const url = 'https://registry.npmmirror.com/vue/-/vue-3.4.21.tgz';
  console.log('full-body download of real tarball:');
  console.log(await fetchFollow(url, false));
  console.log(await fetchFollow(url, true));
  process.exit(0);
})();
