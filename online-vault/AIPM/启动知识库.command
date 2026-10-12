#!/bin/zsh
cd "${0:A:h}" || exit 1
node_bin="$(command -v node)"
if [[ -z "$node_bin" ]]; then
  node_bin="/Users/wubo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$node_bin" ]]; then
  echo "需要 Node.js 运行本地服务器。请安装 Node.js 后重试。"
  read
  exit 1
fi
echo "在浏览器中打开 http://127.0.0.1:4174"
"$node_bin" scripts/serve.mjs
