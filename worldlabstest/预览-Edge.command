#!/bin/zsh
SCRIPT_DIR="${0:A:h}"
if ! /usr/bin/env python3 "$SCRIPT_DIR/tools/start_preview.py"; then
  read '?按回车关闭窗口…'
  exit 1
fi
