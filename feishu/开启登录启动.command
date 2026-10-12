#!/bin/zsh
set -eu
cd -- "${0:A:h:h}"
if ! /usr/bin/python3 feishu/launcher.py --install-login; then
  echo '开启失败。按回车关闭窗口。'
  read -r
  exit 1
fi
