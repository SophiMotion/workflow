#!/bin/zsh
cd "${0:A:h}" || exit 1
/usr/bin/python3 scripts/local-services.py disable
result=$?
if (( result != 0 )); then
  read "?按回车关闭窗口…"
fi
exit $result
