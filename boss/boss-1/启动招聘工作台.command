#!/bin/zsh
set -e
WANT_ROOT="${0:A:h}"
/usr/bin/python3 "$WANT_ROOT/scripts/local-services.py" install --only want
printf '\n招聘工作台：http://127.0.0.1:8770/want.html\n'
