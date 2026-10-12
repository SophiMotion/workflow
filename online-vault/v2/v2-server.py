#!/usr/bin/env python3
"""v2-server.py — SophiMedia 知识库本地 AI 服务器

纯 Python stdlib 实现，无需 pip 安装任何额外包。

用法:
  1. 创建 .env 文件（可选，不配则回复功能降级为关键词匹配）
     CLAUDE_API_KEY=sk-ant-...
  2. 启动服务器
     python3 v2-server.py
  3. 浏览器打开 http://localhost:5000

功能:
  - 提供 v2.html 静态文件服务
  - POST /api/reply — AI 回复（基于 Claude API + 本地文档）
  - POST /api/web-search — 网络学术搜索（DuckDuckGo）
  - GET  /api/health — 健康检查
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from email.utils import formatdate
import mimetypes

# ─── 配置 ───

BASE_DIR = Path(__file__).resolve().parent
INDEX_PATH = BASE_DIR / "v2-index-light.json"
ENV_PATH = BASE_DIR / ".env"
PORT = int(os.environ.get("PORT", "5000"))

# ─── 加载 .env ───

CLAUDE_API_KEY = ""
if ENV_PATH.exists():
    for line in ENV_PATH.read_text("utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if k.strip() == "CLAUDE_API_KEY":
                CLAUDE_API_KEY = v.strip().strip("\"'")
                break

# ─── 加载索引 ───

print(f"📚 正在加载索引…", end=" ", flush=True)
INDEX_DATA = json.loads(INDEX_PATH.read_text("utf-8"))
DOCS = INDEX_DATA["documents"]
DOC_MAP = {d["id"]: d for d in DOCS}
CATEGORIES = INDEX_DATA.get("categories", [])
CHANNEL_COUNTS = INDEX_DATA.get("summary", {}).get("channel_counts", {})
CAT_COUNTS = INDEX_DATA.get("summary", {}).get("category_counts", {})
print(f"{len(DOCS)} 篇资料，{len(CATEGORIES)} 个主题 ✓")


# ═══════════════════════════════════════════════════════════
#  DuckDuckGo 搜索（纯 urllib 实现）
# ═══════════════════════════════════════════════════════════

def duckduckgo_search(query: str, max_results: int = 10) -> list[dict]:
    """使用 DuckDuckGo HTML 版搜索（无需 API Key）"""
    url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query})
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        raise RuntimeError(f"DuckDuckGo 请求失败: {e}")

    results = []
    # 解析 HTML 结果
    for match in re.finditer(
        r'<a[^>]*class="result__a"[^>]*href="(.*?)"[^>]*>(.*?)</a>.*?'
        r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
        html,
        re.DOTALL,
    ):
        href = match.group(1)
        title = re.sub(r"<[^>]+>", "", match.group(2)).strip()
        snippet = re.sub(r"<[^>]+>", "", match.group(3)).strip()
        results.append({"title": title, "href": href, "body": snippet})
        if len(results) >= max_results:
            break

    return results


# ═══════════════════════════════════════════════════════════
#  Claude API 调用（纯 urllib 实现）
# ═══════════════════════════════════════════════════════════

def call_claude(system_prompt: str, user_message: str, max_tokens: int = 2000) -> str:
    """调用 Anthropic Claude API"""
    if not CLAUDE_API_KEY:
        raise RuntimeError("未配置 CLAUDE_API_KEY")

    payload = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "User-Agent": "v2-server/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Claude API 错误 {e.code}: {body}")
    except Exception as e:
        raise RuntimeError(f"Claude API 请求失败: {e}")

    content = result.get("content", [])
    texts = [b.get("text", "") for b in content if b.get("type") == "text"]
    return "\n".join(texts)


# ═══════════════════════════════════════════════════════════
#  HTTP 服务器
# ═══════════════════════════════════════════════════════════

class V2Handler(BaseHTTPRequestHandler):
    """知识库 HTTP 请求处理器"""

    def do_GET(self):
        if self.path == "/api/health":
            return self._json(200, {
                "status": "ok",
                "total_docs": len(DOCS),
                "categories": CATEGORIES,
                "has_claude": bool(CLAUDE_API_KEY),
            })

        if self.path == "/api/config":
            return self._handle_config_status()

        if self.path in ("/", "/index.html"):
            self.path = "/v2.html"

        # 静态文件
        file_path = BASE_DIR / self.path.lstrip("/")
        if file_path.exists() and file_path.is_file():
            content_type, _ = mimetypes.guess_type(str(file_path))
            content_type = content_type or "application/octet-stream"
            data = file_path.read_bytes()
            self._raw(200, content_type, data)
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        data = json.loads(body) if body else {}

        if self.path == "/api/config":
            self._handle_config(data)
        elif self.path == "/api/reply":
            self._handle_reply(data)
        elif self.path == "/api/web-search":
            self._handle_web_search(data)
        else:
            self._json(404, {"error": "not found"})

    def do_OPTIONS(self):
        """CORS preflight"""
        self._cors_headers()
        self.send_response(200)
        self.end_headers()

    # ── Handlers ──

    def _handle_config(self, data):
        """动态设置 CLAUDE_API_KEY（从前端传入）"""
        global CLAUDE_API_KEY
        key = data.get("claude_api_key", "").strip()
        if key:
            if key.startswith("sk-ant-"):
                CLAUDE_API_KEY = key
                # 也保存到 .env 文件，重启后仍有效
                try:
                    env_path = BASE_DIR / ".env"
                    existing = ""
                    if env_path.exists():
                        existing = env_path.read_text("utf-8")
                    if "CLAUDE_API_KEY=" in existing:
                        lines = existing.splitlines()
                        new_lines = []
                        for line in lines:
                            if line.strip().startswith("CLAUDE_API_KEY="):
                                new_lines.append(f"CLAUDE_API_KEY={key}")
                            else:
                                new_lines.append(line)
                        env_path.write_text("\n".join(new_lines) + "\n", "utf-8")
                    else:
                        with open(env_path, "a") as f:
                            f.write(f"\nCLAUDE_API_KEY={key}\n")
                    return self._json(200, {"status": "ok", "message": "API Key 已配置"})
                except Exception as e:
                    return self._json(200, {"status": "ok", "message": f"API Key 已设置（但保存到 .env 失败: {e}）"})
            else:
                return self._json(400, {"error": "无效的 API Key，应以 sk-ant- 开头"})
        return self._json(400, {"error": "缺少 claude_api_key"})

    def _handle_config_status(self):
        """返回服务器配置状态（不暴露完整 key）"""
        return self._json(200, {
            "has_claude": bool(CLAUDE_API_KEY),
            "server_ready": True,
        })

    def _handle_reply(self, data):
        question = data.get("question", "").strip()
        doc_ids = data.get("doc_ids", [])

        if not question:
            return self._json(400, {"error": "缺少问题"})

        # 获取上下文文档
        context_docs = [DOC_MAP.get(did) for did in doc_ids if did in DOC_MAP]
        context_docs = [d for d in context_docs if d][:10]

        if not context_docs:
            return self._json(200, {"answer": "未找到相关文档作为参考。", "citations": []})

        # 构建上下文文本
        context_parts = []
        for i, d in enumerate(context_docs):
            excerpt = (d.get("excerpt", "") or "")[:500]
            ctx = (
                f"[{i+1}] {d.get('title','')}\n"
                f"  来源: {d.get('channel','')} | {d.get('category','')}\n"
                f"  摘要: {excerpt}"
            )
            context_parts.append(ctx)
        context_str = "\n\n".join(context_parts)

        # 尝试 Claude API
        if CLAUDE_API_KEY:
            try:
                system_prompt = (
                    "你是 SophiMedia 知识库的 AI 研究助手。"
                    "基于用户提供的知识库资料回答问题。\n"
                    "要求：\n"
                    "1）严格基于资料，不编造\n"
                    "2）标注引用如 [1][2]\n"
                    "3）末尾列出引用来源\n"
                    "4）中文回答"
                )
                user_msg = f"问题: {question}\n\n相关资料:\n\n{context_str}"
                answer = call_claude(system_prompt, user_msg)
            except Exception as e:
                answer = f"⚠️ AI 调用失败: {e}"
        else:
            # 降级：关键词匹配摘要拼接
            answer = (
                "⚠️ **未配置 Claude API Key**\n\n"
                "请在 v2/.env 文件中添加:\n"
                "```\nCLAUDE_API_KEY=你的密钥\n```\n\n"
                "基于文档的关键词匹配结果:\n\n"
            )
            for d in context_docs[:5]:
                excerpt = (d.get("excerpt", "") or "")[:200]
                answer += f"• **{d.get('title','')}** — {excerpt}\n"

        citations = [
            {"id": d["id"], "title": d.get("title", ""), "url": d.get("source_url", "")}
            for d in context_docs
        ]
        self._json(200, {"answer": answer, "citations": citations})

    def _handle_web_search(self, data):
        question = data.get("question", "").strip()
        if not question:
            return self._json(400, {"error": "缺少问题"})

        try:
            results = duckduckgo_search(question)
        except Exception as e:
            return self._json(200, {"answer": f"搜索失败: {e}", "sources": []})

        if not results:
            return self._json(200, {"answer": "未找到相关网络结果。", "sources": []})

        # 如果配置了 Claude，用 AI 综合搜索结果
        if CLAUDE_API_KEY and results:
            search_summary = "\n".join(
                f"[{i+1}] {r['title']}\n    {r['body'][:300]}\n    {r['href']}"
                for i, r in enumerate(results[:10])
            )
            try:
                system_prompt = (
                    "你是一个学术与网络研究助手。基于网络搜索结果，"
                    "针对用户问题提供综合论证分析。\n"
                    "要求：\n"
                    "1）标注引用 [1][2]\n"
                    "2）区分学术来源和网络来源\n"
                    "3）中文回答\n"
                    "4）末尾列参考文献"
                )
                user_msg = f"问题: {question}\n\n网络搜索结果:\n\n{search_summary}"
                answer = call_claude(system_prompt, user_msg)
            except Exception as e:
                answer = f"⚠️ AI 综合失败，展示原始搜索结果:\n\n"
                answer += "\n".join(
                    f"[{i+1}] {r['title']} — {r['href']}"
                    for i, r in enumerate(results[:10])
                )
        else:
            # 直接展示搜索结果
            answer = "网络搜索结果:\n\n" + "\n".join(
                f"[{i+1}] {r['title']}\n    {r['href']}\n    {r['body'][:200]}"
                for i, r in enumerate(results[:10])
            )

        sources = [{"title": r["title"], "url": r["href"]} for r in results[:10]]
        self._json(200, {"answer": answer, "sources": sources})

    # ── Response helpers ──

    def _json(self, status, data):
        self._raw(status, "application/json; charset=utf-8",
                  json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _raw(self, status, content_type, data):
        self._cors_headers()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Date", formatdate(timeval=None, localtime=False, usegmt=True))
        self.end_headers()
        self.wfile.write(data)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        print(f"  [{self.command}] {self.path} - {args[0] if args else ''}")


def main():
    if not CLAUDE_API_KEY:
        print("⚠️  未设置 CLAUDE_API_KEY")
        print(f"   创建 {ENV_PATH} 添加: CLAUDE_API_KEY=sk-ant-...")
        print("   也可在浏览器页面中直接输入 API Key\n")

    # ─── 自动释放端口 5000 ───
    import subprocess, signal
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{PORT}"],
            capture_output=True, text=True, timeout=5
        )
        if result.stdout.strip():
            old_pids = result.stdout.strip().split()
            print(f"🔄 发现端口 {PORT} 被占用 (PID: {', '.join(old_pids)})，正在释放…")
            for pid_str in old_pids:
                try:
                    os.kill(int(pid_str), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            time.sleep(0.5)
            print(f"   ✅ 端口 {PORT} 已释放")
    except Exception:
        pass

    server = HTTPServer(("0.0.0.0", PORT), V2Handler)
    print(f"🚀 v2 知识库服务器启动:", flush=True)
    print(f"   本地访问: http://localhost:{PORT}")
    print(f"   网络访问: http://0.0.0.0:{PORT}")
    print(f"   按 Ctrl+C 停止\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 服务器已停止")
        server.server_close()


if __name__ == "__main__":
    main()
