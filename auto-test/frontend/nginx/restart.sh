#!/bin/bash
# ==============================================================================
#  AutoTest Nginx 重启/重载脚本 (ARM64 Linux)
#  修改 nginx.conf 后执行本脚本让配置生效
#  用法: 在 nginx 目录下执行  ./restart.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_BIN="$SCRIPT_DIR/sbin/nginx"
CONF="conf/nginx.conf"

if [ ! -x "$NGINX_BIN" ]; then
  echo "✗ 未找到 nginx 二进制: $NGINX_BIN"
  exit 1
fi

# 先校验配置
echo ">>> 检查配置语法 ..."
"$NGINX_BIN" -t -p "$SCRIPT_DIR" -c "$CONF"
if [ $? -ne 0 ]; then
  echo "✗ 配置错误，未重载"
  exit 1
fi

echo ">>> 平滑重载配置 ..."
"$NGINX_BIN" -p "$SCRIPT_DIR" -c "$CONF" -s reload

if [ $? -eq 0 ]; then
  echo "✓ 配置已重载（Nginx 未中断服务）"
else
  echo "✗ 重载失败，可能 Nginx 未运行。请改用 ./start.sh 启动"
  exit 1
fi
