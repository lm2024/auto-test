import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/auth/login':
            self.send_error(404)
            return
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or '{}')
        if body.get('username') != 'demo' or body.get('password') != 'demo-pass':
            self.send_json(401, {'message': 'invalid credentials'})
            return
        self.send_json(200, {'token': 'password-demo-token', 'expiresIn': 3600})

    def send_json(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print('[password-demo]', fmt % args, flush=True)

HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
