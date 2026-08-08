#!/usr/bin/env bash
set -euo pipefail

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

echo "[1/5] password login"
password_response=$(curl -fsS -X POST http://localhost:18101/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"username":"demo","password":"demo-pass"}')
echo "$password_response" | grep -q 'password-demo-token'

echo "[2/5] cookie session"
cookie_headers=$(curl -fsS -D - -o /tmp/login-cookie-response \
  -X POST http://localhost:18102/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"username":"demo","password":"demo-pass"}')
echo "$cookie_headers" | grep -qi 'Set-Cookie: SESSION=cookie-demo-session'

echo "[3/5] oauth2 client credentials"
oauth_response=$(curl -fsS -X POST http://localhost:18103/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'grant_type=client_credentials&client_id=demo-client&client_secret=demo-secret')
echo "$oauth_response" | grep -q 'oauth2-demo-token'

echo "[4/5] CAS REST"
cas_headers=$(curl -fsS -D - -o /tmp/login-cas-response \
  -X POST http://localhost:18104/cas/v1/tickets \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'username=demo&password=demo-pass')
echo "$cas_headers" | grep -q '201'
echo "$cas_headers" | grep -q '/cas/tickets/TGT-demo'

echo "[5/5] browser page"
browser_page=$(curl -fsS http://localhost:18105/login)
echo "$browser_page" | grep -q 'id="username"'
echo "$browser_page" | grep -q 'id="password"'
echo "$browser_page" | grep -q 'id="login-btn"'

echo "All login demos passed."
