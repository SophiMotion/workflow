#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  echo '需要 Node.js 22 或更新版本。安装后重新运行此文件。'
  read -r
  exit 1
fi
if [[ ! -d node_modules ]]; then npm install; fi
if curl --noproxy '*' -fsS http://127.0.0.1:4173/api/skate/health >/dev/null 2>&1; then
  open http://127.0.0.1:4173
  exit 0
fi
echo 'SophiStudio 机器人工作台：http://127.0.0.1:4173'
echo '保持此终端运行。按 Ctrl+C 停止服务。'
(sleep 2; open http://127.0.0.1:4173) &
npm run dev
