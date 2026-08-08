import json
from urllib.parse import parse_qs
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/oauth/token':
            self.send_error(404)
            return
        raw = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        form = {k: v[0] for k, v in parse_qs(raw).items()}
        if form.get('client_id') != 'demo-client' or form.get('client_secret') != 'demo-secret':
            self.send_json(401, {'error': 'invalid_client'})
            return
        if form.get('grant_type') != 'client_credentials':
            self.send_json(400, {'error': 'unsupported_grant_type'})
            return
        self.send_json(200, {'access_token': 'oauth2-demo-token', 'token_type': 'Bearer', 'expires_in': 3600})

    def send_json(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print('[oauth2-demo]', fmt % args, flush=True)

HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
