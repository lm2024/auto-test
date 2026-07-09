#!/bin/bash
# ==============================================================================
#  AutoTest Nginx 启动脚本 (ARM64 Linux)
#  用法: 在 nginx 目录下执行  ./start.sh
# ==============================================================================

# 获取本脚本所在目录（即 nginx 目录，作为运行前缀 prefix）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_BIN="$SCRIPT_DIR/sbin/nginx"
CONF="conf/nginx.conf"

# 确保日志目录存在
mkdir -p "$SCRIPT_DIR/logs"

# 检查二进制
if [ ! -x "$NGINX_BIN" ]; then
  echo "✗ 未找到可执行 nginx 二进制: $NGINX_BIN"
  exit 1
fi

# 检查配置文件语法
echo ">>> 检查配置语法 ..."
"$NGINX_BIN" -t -p "$SCRIPT_DIR" -c "$CONF"
if [ $? -ne 0 ]; then
  echo "✗ 配置检查失败，请查看上方报错后修正 nginx.conf"
  exit 1
fi

# 启动
echo ">>> 启动 Nginx ..."
"$NGINX_BIN" -p "$SCRIPT_DIR" -c "$CONF"

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Nginx 已启动"
  echo "  前端页面:  http://<本机IP>   (或你在 nginx.conf 里改的端口)"
  echo "  日志目录:  $SCRIPT_DIR/logs/"
  echo ""
  echo "  注意: 若 nginx.conf 中 listen 用的是 80 端口，必须用 root 运行本脚本"
  echo "        (如: sudo ./start.sh)，否则会因权限不足启动失败。"
  echo "        若不想用 root，把 listen 改成 8081 等高端口即可。"
else
  echo "✗ 启动失败，请查看 $SCRIPT_DIR/logs/error.log"
  exit 1
fi
