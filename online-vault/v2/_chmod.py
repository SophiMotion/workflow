#!/usr/bin/env python3
"""Make 启动.command executable"""
import os, stat
p = "/Users/wubo/Documents/2026-2/SophiMedia/online-vault/v2/启动.command"
os.chmod(p, os.stat(p).st_mode | stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
print("✅ 启动.command 已设为可执行")

# Also update the welcome note in v2.html
htmlp = "/Users/wubo/Documents/2026-2/SophiMedia/online-vault/v2/v2.html"
html = open(htmlp, "r", encoding="utf-8").read()
old = "AI 回复需要启动 <code>python3 v2/v2-server.py</code>。"
new = "AI 功能需双击「启动.command」一键启用（macOS）或「启动.bat」（Windows）。"
if old in html:
    html = html.replace(old, new)
    open(htmlp, "w", encoding="utf-8").write(html)
    print("✅ v2.html 欢迎文本已更新")
else:
    # try to find the actual text
    import re
    m = re.search(r"AI 回复需要启动.*?</code>。", html)
    if m:
        print(f"Found different text: {m.group()}")
    print("⚠️ 未找到需要替换的文本（可能已更新）")
