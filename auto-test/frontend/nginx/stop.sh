#!/bin/bash
# ==============================================================================
#  AutoTest Nginx 停止脚本 (ARM64 Linux)
#  用法: 在 nginx 目录下执行  ./stop.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_BIN="$SCRIPT_DIR/sbin/nginx"
CONF="conf/nginx.conf"

if [ ! -x "$NGINX_BIN" ]; then
  echo "✗ 未找到 nginx 二进制: $NGINX_BIN"
  exit 1
fi

echo ">>> 停止 Nginx ..."
"$NGINX_BIN" -p "$SCRIPT_DIR" -c "$CONF" -s stop

if [ $? -eq 0 ]; then
  echo "✓ Nginx 已停止"
else
  echo "✗ 停止失败（可能未运行，或需用相同用户/权限执行）"
  exit 1
fi
