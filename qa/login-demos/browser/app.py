from http.server import BaseHTTPRequestHandler, HTTPServer

PAGE = '''<!doctype html><html><body>
<h1>Browser Login Demo</h1>
<input id="username" autocomplete="username"><input id="password" type="password" autocomplete="current-password">
<button id="login-btn">Login</button><div class="user-info" hidden>Logged in</div>
<script>
document.querySelector('#login-btn').onclick = () => {
  if (document.querySelector('#username').value === 'demo' && document.querySelector('#password').value === 'demo-pass') {
    localStorage.setItem('access_token', 'browser-demo-token');
    document.cookie = 'SESSION=browser-demo-session; Path=/';
    document.querySelector('.user-info').hidden = false;
  } else { alert('invalid credentials'); }
};
</script></body></html>'''

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = PAGE.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print('[browser-demo]', fmt % args, flush=True)

HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
