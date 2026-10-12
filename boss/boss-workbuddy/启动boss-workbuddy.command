#!/bin/zsh
# 一键启动 BOSS 招聘控制台：启动本地服务并打开控制台页面
set -e
ROOT="${0:A:h}"
PORT=8771

# 检查服务是否已运行
if curl -s --max-time 1 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "控制台服务已在运行"
else
  echo "启动控制台服务…"
  nohup /usr/bin/env node "$ROOT/server.js" > "$ROOT/server.log" 2>&1 &
  disown
  sleep 1
fi

# 打开控制台页面
echo "打开控制台：http://127.0.0.1:${PORT}/boss-workbuddy.html"
open "http://127.0.0.1:${PORT}/boss-workbuddy.html"
