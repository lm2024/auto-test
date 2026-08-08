from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/cas/v1/tickets':
            raw = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
            form = {k: v[0] for k, v in parse_qs(raw).items()}
            if form.get('username') != 'demo' or form.get('password') != 'demo-pass':
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'authentication failed')
                return
            self.send_response(201)
            self.send_header('Location', 'http://localhost:18104/cas/tickets/TGT-demo')
            self.end_headers()
            return
        if self.path == '/cas/tickets/TGT-demo':
            self.rfile.read(int(self.headers.get('Content-Length', 0)))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ST-demo-ticket')
            return
        self.send_error(404)

    def log_message(self, fmt, *args):
        print('[cas-demo]', fmt % args, flush=True)

HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
