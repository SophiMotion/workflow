from __future__ import annotations

import argparse
import csv
import hashlib
import html
import http.client
import re
import socket
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from lxml import etree
from lxml import html as lxml_html


CATEGORIES = [
    "社区",
    "数字制造",
    "交通工具",
    "UNNC",
    "团队管理",
    "工具",
    "产品分析",
    "FabLab",
    "autodesk",
    "HIL",
    "AI工具",
    "政策",
    "教育",
]


@dataclass
class PageCard:
    category: str
    title: str
    url: str
    content_type: str = ""
    domain: str = ""
    level1: str = ""
    level2: str = ""
    level3: str = ""
    original_path: str = ""
    keywords: str = ""


@dataclass
class ArchiveResult:
    category: str
    title: str
    url: str
    status: str
    http_status: str
    final_url: str
    md_path: str
    html_path: str
    text_chars: int
    error: str


def clean_text(value: str) -> str:
    return " ".join((value or "").replace("\xa0", " ").split())


def safe_filename(title: str, url: str) -> str:
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "") or parsed.scheme or "local"
    base = clean_text(title) or domain or "page"
    base = re.sub(r"[\\/:*?\"<>|#%&{}$!'@+`=]+", " ", base)
    base = re.sub(r"\s+", "-", base).strip("-_. ")
    base = base[:70] or "page"
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    return f"{base}-{digest}"


def parse_existing_cards(root: Path) -> list[PageCard]:
    cards: list[PageCard] = []
    heading_re = re.compile(r"\[(?P<title>[^\]]+)\]\(<(?P<url>[^>]+)>\)")
    for category in CATEGORIES:
        index_path = root / "md" / category / "index.md"
        if not index_path.exists():
            continue
        current: PageCard | None = None
        for line in index_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("###### "):
                if current and current.url:
                    cards.append(current)
                matches = list(heading_re.finditer(line))
                match = matches[-1] if matches else None
                if match:
                    current = PageCard(
                        category=category,
                        title=clean_text(match.group("title").replace("\\[", "[").replace("\\]", "]")),
                        url=match.group("url").strip(),
                    )
                else:
                    current = PageCard(category=category, title=clean_text(line.lstrip("#![]() ")), url="")
                continue
            if not current:
                continue
            if line.startswith("- 原文链接: <"):
                current.url = line.split("<", 1)[1].split(">", 1)[0].strip()
            elif line.startswith("- 内容类型: `"):
                current.content_type = line.split("`", 1)[1].rsplit("`", 1)[0]
            elif line.startswith("- 域名: `"):
                current.domain = line.split("`", 1)[1].rsplit("`", 1)[0]
            elif line.startswith("- 一级目录: `"):
                current.level1 = line.split("`", 1)[1].rsplit("`", 1)[0]
            elif line.startswith("- 二级目录: `"):
                current.level2 = line.split("`", 1)[1].rsplit("`", 1)[0]
            elif line.startswith("- 三级目录: `"):
                current.level3 = line.split("`", 1)[1].rsplit("`", 1)[0]
            elif line.startswith("- 原始目录: `"):
                current.original_path = line.split("`", 1)[1].rsplit("`", 1)[0]
            elif line.startswith("- 关键词: "):
                current.keywords = line.replace("- 关键词: ", "", 1).strip()
        if current and current.url:
            cards.append(current)

    seen: set[str] = set()
    unique_cards: list[PageCard] = []
    for card in cards:
        if card.url in seen:
            continue
        seen.add(card.url)
        unique_cards.append(card)
    return unique_cards


def charset_from_content_type(content_type: str) -> str:
    match = re.search(r"charset=([^;\s]+)", content_type or "", flags=re.I)
    return (match.group(1).strip("\"'") if match else "utf-8") or "utf-8"


def fetch_page(url: str, timeout: int, max_bytes: int) -> tuple[bytes, str, str, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
    }
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                body = body[:max_bytes]
            return body, str(getattr(response, "status", "")), response.geturl(), response.headers.get("content-type", "")
    except HTTPError as exc:
        body = exc.read(max_bytes + 1)
        if len(body) > max_bytes:
            body = body[:max_bytes]
        return body, str(exc.code), exc.geturl() or url, exc.headers.get("content-type", "")


def strip_noisy_elements(node: etree._Element) -> None:
    # 中英双语注释：移除导航与脚本噪声 / Remove navigation and script noise.
    etree.strip_elements(
        node,
        "script",
        "style",
        "noscript",
        "iframe",
        "svg",
        "canvas",
        "form",
        "button",
        "input",
        "select",
        "textarea",
        with_tail=False,
    )
    for noisy in node.xpath(
        ".//*[self::nav or self::header or self::footer or self::aside]"
        "|.//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'nav')]"
        "|.//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'footer')]"
        "|.//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sidebar')]"
        "|.//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'comment')]"
        "|.//*[contains(translate(@id,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'comment')]"
    ):
        parent = noisy.getparent()
        if parent is not None:
            parent.remove(noisy)


def node_text_len(node: etree._Element) -> int:
    return len(clean_text(node.text_content()))


def link_text_len(node: etree._Element) -> int:
    return sum(len(clean_text(a.text_content())) for a in node.xpath(".//a"))


def pick_article(doc: etree._Element) -> etree._Element:
    strip_noisy_elements(doc)
    # 中英双语注释：微信公众号优先正文块 / Prefer WeChat article body containers.
    dedicated = doc.xpath(
        "//*[@id='js_content'] | //*[@id='img-content'] | "
        "//*[contains(@class,'rich_media_content')] | //article"
    )
    dedicated = [node for node in dedicated if node_text_len(node) >= 80 or len(node.xpath(".//img")) >= 1]
    if dedicated:
        dedicated.sort(key=lambda node: node_text_len(node), reverse=True)
        return dedicated[0]
    candidates = doc.xpath(
        "//article | //main | //*[@role='main'] | "
        "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'article')] | "
        "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'post')] | "
        "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'content')] | "
        "//*[contains(translate(@id,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'article')] | "
        "//*[contains(translate(@id,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'content')]"
    )
    body = doc.find("body")
    if body is not None:
        candidates.append(body)
    if not candidates:
        return doc
    scored = []
    for candidate in candidates:
        text_len = node_text_len(candidate)
        if text_len < 80:
            continue
        links = link_text_len(candidate)
        paragraphs = len(candidate.xpath(".//p"))
        headings = len(candidate.xpath(".//h1|.//h2|.//h3"))
        score = text_len - int(links * 1.7) + paragraphs * 80 + headings * 40
        scored.append((score, text_len, candidate))
    if not scored:
        return body if body is not None else doc
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return scored[0][2]


def page_title(doc: etree._Element, fallback: str) -> str:
    for xpath in (
        "//meta[@property='og:title']/@content",
        "//meta[@name='twitter:title']/@content",
        "//title/text()",
        "//h1/text()",
    ):
        values = [clean_text(v) for v in doc.xpath(xpath) if clean_text(v)]
        if values:
            return values[0]
    return fallback


def text_content(node: etree._Element) -> str:
    value = clean_text(node.text_content())
    return value


def inline_markdown(node: etree._Element) -> str:
    if isinstance(node, etree._Comment):
        return ""
    tag = node.tag.lower() if isinstance(node.tag, str) else ""
    parts: list[str] = []
    if node.text:
        parts.append(node.text)
    for child in node:
        parts.append(element_to_markdown(child).strip("\n"))
        if child.tail:
            parts.append(child.tail)
    text = clean_text(" ".join(part for part in parts if part))
    if tag == "a":
        href = node.get("href", "").strip()
        return f"[{text or href}]({href})" if href else text
    if tag in {"strong", "b"} and text:
        return f"**{text}**"
    if tag in {"em", "i"} and text:
        return f"*{text}*"
    if tag == "code" and text:
        return f"`{text}`"
    return text


def element_to_markdown(node: etree._Element) -> str:
    tag = node.tag.lower() if isinstance(node.tag, str) else ""
    if tag in {"script", "style", "noscript"}:
        return ""
    if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        level = int(tag[1])
        return f"\n{'#' * min(level + 1, 6)} {inline_markdown(node)}\n"
    if tag == "p":
        return f"\n{inline_markdown(node)}\n"
    if tag in {"br"}:
        return "\n"
    if tag == "img":
        src = node.get("src", "").strip()
        alt = clean_text(node.get("alt", "图片"))
        return f"![{alt}]({src})" if src else ""
    if tag == "li":
        return f"- {inline_markdown(node)}\n"
    if tag in {"ul", "ol"}:
        return "\n" + "\n".join(element_to_markdown(child).rstrip() for child in node) + "\n"
    if tag == "blockquote":
        body = "\n".join(f"> {line}" if line.strip() else ">" for line in inline_markdown(node).splitlines())
        return f"\n{body}\n"
    if tag == "pre":
        code = node.text_content().strip("\n")
        return f"\n```\n{code}\n```\n"
    if tag in {"table"}:
        return f"\n{text_content(node)}\n"
    return "\n".join(element_to_markdown(child).strip("\n") for child in node if element_to_markdown(child).strip("\n")) or inline_markdown(node)


def article_to_markdown(article: etree._Element) -> str:
    chunks = []
    for child in article:
        md = element_to_markdown(child).strip()
        if md:
            chunks.append(md)
    result = "\n\n".join(chunks).strip()
    if len(result) < 100:
        text = text_content(article)
        result = "\n\n".join(re.split(r"(?<=[。！？.!?])\s+", text))
    return re.sub(r"\n{3,}", "\n\n", result).strip()


def render_local_html(card: PageCard, title: str, article_html: str, status: str, http_status: str, final_url: str, error: str) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif; background: #f6f7f9; color: #172033; line-height: 1.68; }}
    main {{ max-width: 920px; margin: 0 auto; padding: 28px 16px 64px; }}
    .meta {{ background: #fff; border: 1px solid #dbe2ea; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; color: #475569; font-size: 14px; }}
    .meta div {{ margin: 4px 0; overflow-wrap: anywhere; }}
    article {{ background: #fff; border: 1px solid #dbe2ea; border-radius: 8px; padding: 22px; overflow-wrap: anywhere; }}
    img {{ max-width: 100%; height: auto; }}
    pre {{ overflow-x: auto; background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; }}
    code {{ background: #eef2f7; padding: 1px 4px; border-radius: 4px; }}
    a {{ color: #0f766e; }}
    blockquote {{ border-left: 4px solid #94a3b8; margin-left: 0; padding-left: 14px; color: #475569; }}
  </style>
</head>
<body>
  <main>
    <h1>{html.escape(title)}</h1>
    <section class="meta">
      <div><strong>原文链接:</strong> <a href="{html.escape(card.url, quote=True)}">{html.escape(card.url)}</a></div>
      <div><strong>最终链接:</strong> <a href="{html.escape(final_url or card.url, quote=True)}">{html.escape(final_url or card.url)}</a></div>
      <div><strong>主题:</strong> {html.escape(card.category)}</div>
      <div><strong>目录:</strong> {html.escape(card.level1)} / {html.escape(card.level2)} / {html.escape(card.level3)}</div>
      <div><strong>域名:</strong> {html.escape(card.domain)}</div>
      <div><strong>状态:</strong> {html.escape(status)} {html.escape(http_status)}</div>
      {f"<div><strong>错误:</strong> {html.escape(error)}</div>" if error else ""}
    </section>
    <article>
{article_html}
    </article>
  </main>
</body>
</html>
"""


def markdown_header(card: PageCard, title: str, status: str, http_status: str, final_url: str, error: str) -> str:
    rows = [
        "---",
        f'title: "{title.replace(chr(34), chr(39))}"',
        f"source_url: {card.url}",
        f"final_url: {final_url or card.url}",
        f"category: {card.category}",
        f"domain: {card.domain}",
        f"content_type: {card.content_type}",
        f"level1: {card.level1}",
        f"level2: {card.level2}",
        f"level3: {card.level3}",
        f"status: {status}",
        f"http_status: {http_status}",
        f"archived_at: {datetime.now().isoformat(timespec='seconds')}",
        "---",
        "",
        f"# {title}",
        "",
        f"- 原文链接: <{card.url}>",
        f"- 最终链接: <{final_url or card.url}>",
        f"- 主题分类: `{card.category}`",
        f"- 目录: `{card.level1} / {card.level2} / {card.level3}`",
        f"- 域名: `{card.domain}`",
        f"- 抓取状态: `{status}`",
    ]
    if http_status:
        rows.append(f"- HTTP 状态: `{http_status}`")
    if error:
        rows.append(f"- 错误说明: `{error}`")
    rows.extend(["", "## 正文", ""])
    return "\n".join(rows)


def archive_one(card: PageCard, root: Path, timeout: int, max_bytes: int, force: bool) -> ArchiveResult:
    filename = safe_filename(card.title, card.url)
    md_dir = root / "md" / card.category / "pages"
    html_dir = root / "html" / card.category / "pages"
    md_dir.mkdir(parents=True, exist_ok=True)
    html_dir.mkdir(parents=True, exist_ok=True)
    md_path = md_dir / f"{filename}.md"
    html_path = html_dir / f"{filename}.html"
    rel_md = str(md_path.relative_to(root))
    rel_html = str(html_path.relative_to(root))
    if md_path.exists() and html_path.exists() and not force:
        existing = md_path.read_text(encoding="utf-8", errors="replace")
        status_match = re.search(r"^status:\s*(.+)$", existing, flags=re.M)
        http_match = re.search(r"^http_status:\s*(.*)$", existing, flags=re.M)
        final_match = re.search(r"^final_url:\s*(.+)$", existing, flags=re.M)
        status = clean_text(status_match.group(1)) if status_match else "skipped_existing"
        http_status = clean_text(http_match.group(1)) if http_match else ""
        final_url = clean_text(final_match.group(1)) if final_match else card.url
        text_chars = len(clean_text(existing.split("## 正文", 1)[-1])) if "## 正文" in existing else 0
        return ArchiveResult(card.category, card.title, card.url, status, http_status, final_url, rel_md, rel_html, text_chars, "")

    scheme = urlparse(card.url).scheme.lower()
    if scheme not in {"http", "https"}:
        error = f"unsupported scheme: {scheme or 'none'}"
        title = card.title or card.url
        body_md = markdown_header(card, title, "unsupported", "", card.url, error) + f"该链接不是可抓取网页协议，已保留原文入口：<{card.url}>\n"
        md_path.write_text(body_md, encoding="utf-8")
        html_path.write_text(render_local_html(card, title, f"<p>该链接不是可抓取网页协议，已保留原文入口：<a href=\"{html.escape(card.url, quote=True)}\">{html.escape(card.url)}</a></p>", "unsupported", "", card.url, error), encoding="utf-8")
        return ArchiveResult(card.category, title, card.url, "unsupported", "", card.url, rel_md, rel_html, 0, error)

    status = "failed"
    http_status = ""
    final_url = card.url
    error = ""
    title = card.title or card.url
    article_html = ""
    md_body = ""
    text_chars = 0
    try:
        raw, http_status, final_url, content_type = fetch_page(card.url, timeout=timeout, max_bytes=max_bytes)
        if not raw:
            raise ValueError("empty response")
        if "html" not in (content_type or "").lower() and "xml" not in (content_type or "").lower() and not raw.lstrip().startswith(b"<"):
            raise ValueError(f"non-html content: {content_type}")
        doc = lxml_html.fromstring(raw)
        doc.make_links_absolute(final_url, resolve_base_href=True)
        title = page_title(doc, title)
        article = pick_article(doc)
        article_html = lxml_html.tostring(article, encoding="unicode", method="html")
        md_body = article_to_markdown(article)
        text_chars = len(clean_text(article.text_content()))
        status = "ok" if text_chars >= 120 else "low_text"
        if "该内容已被发布者删除" in md_body or "内容已被发布者删除" in md_body or "此内容因违规无法查看" in md_body:
            status = "deleted_or_unavailable"
        if http_status and not http_status.startswith("2"):
            status = f"http_{http_status}"
    except (HTTPError, URLError, TimeoutError, ValueError, etree.ParserError, UnicodeError, OSError, http.client.HTTPException, Exception) as exc:
        error = clean_text(str(exc))[:500]
        title = card.title or card.url
        article_html = f"<p>正文抓取失败。已保留原文链接：<a href=\"{html.escape(card.url, quote=True)}\">{html.escape(card.url)}</a></p>"
        md_body = f"正文抓取失败。已保留原文链接：<{card.url}>"
        status = "failed"

    md_path.write_text(markdown_header(card, title, status, http_status, final_url, error) + md_body + "\n", encoding="utf-8")
    html_path.write_text(render_local_html(card, title, article_html, status, http_status, final_url, error), encoding="utf-8")
    return ArchiveResult(card.category, title, card.url, status, http_status, final_url, rel_md, rel_html, text_chars, error)


def write_placeholder(card: PageCard, root: Path, status: str = "not_fetched_timeout") -> ArchiveResult:
    filename = safe_filename(card.title, card.url)
    md_dir = root / "md" / card.category / "pages"
    html_dir = root / "html" / card.category / "pages"
    md_dir.mkdir(parents=True, exist_ok=True)
    html_dir.mkdir(parents=True, exist_ok=True)
    md_path = md_dir / f"{filename}.md"
    html_path = html_dir / f"{filename}.html"
    rel_md = str(md_path.relative_to(root))
    rel_html = str(html_path.relative_to(root))
    title = card.title or card.url
    error = "联网抓取阶段连接超时或进程中止；已生成本地占位页并保留原文链接。"
    body = f"该页面暂未成功抓取正文。已保留原文链接，后续可按 manifest 单独补抓：<{card.url}>"
    md_path.write_text(markdown_header(card, title, status, "", card.url, error) + body + "\n", encoding="utf-8")
    html_path.write_text(
        render_local_html(
            card,
            title,
            f"<p>{html.escape(body)}</p>",
            status,
            "",
            card.url,
            error,
        ),
        encoding="utf-8",
    )
    return ArchiveResult(card.category, title, card.url, status, "", card.url, rel_md, rel_html, len(body), error)


def text_saved(item: ArchiveResult) -> bool:
    return item.status in {"ok", "low_text"}


def write_indexes(root: Path, results: Iterable[ArchiveResult]) -> None:
    results = list(results)
    by_category: dict[str, list[ArchiveResult]] = {category: [] for category in CATEGORIES}
    for result in results:
        by_category.setdefault(result.category, []).append(result)

    manifest_path = root / "web_pages_archive_manifest.csv"
    with manifest_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["category", "title", "url", "status", "http_status", "final_url", "md_path", "html_path", "text_chars", "error"],
        )
        writer.writeheader()
        for result in results:
            writer.writerow(result.__dict__)

    for category, items in by_category.items():
        md_index = root / "md" / category / "pages" / "index.md"
        html_index = root / "html" / category / "pages" / "index.html"
        md_index.parent.mkdir(parents=True, exist_ok=True)
        html_index.parent.mkdir(parents=True, exist_ok=True)
        md_lines = [
            f"# {category} 正文归档",
            "",
            f"- 页面数: {len(items)}",
            f"- 正文可用或部分可用: {sum(1 for item in items if text_saved(item))}",
            f"- 错误或占位: {sum(1 for item in items if not text_saved(item))}",
            "",
            "| 状态 | 标题 | 原文链接 | 本地 Markdown | 本地 HTML |",
            "|---|---|---|---|---|",
        ]
        html_rows = []
        for item in sorted(items, key=lambda x: (x.status, x.title.lower())):
            md_rel = Path(item.md_path).name
            html_rel = Path(item.html_path).name
            md_lines.append(
                f"| `{item.status}` | {item.title.replace('|', '/')} | [原文](<{item.url}>) | [{md_rel}](<{md_rel}>) | [{html_rel}](<{html_rel}>) |"
            )
            html_rows.append(
                f"<tr><td>{html.escape(item.status)}</td><td>{html.escape(item.title)}</td><td><a href=\"{html.escape(item.url, quote=True)}\">原文</a></td><td><a href=\"{html.escape(html_rel, quote=True)}\">本地 HTML</a></td></tr>"
            )
        md_index.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
        html_index.write_text(
            "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            f"<title>{html.escape(category)} 正文归档</title><style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif;max-width:1100px;margin:0 auto;padding:24px;line-height:1.6;background:#f6f7f9;color:#172033}}table{{width:100%;border-collapse:collapse;background:#fff}}td,th{{border:1px solid #dbe2ea;padding:8px;vertical-align:top}}th{{background:#eef2f7}}a{{color:#0f766e}}</style></head><body>"
            f"<h1>{html.escape(category)} 正文归档</h1><p>页面数：{len(items)}</p><table><thead><tr><th>状态</th><th>标题</th><th>原文</th><th>本地页面</th></tr></thead><tbody>{''.join(html_rows)}</tbody></table></body></html>",
            encoding="utf-8",
        )

    root_index_lines = [
        "# 1119 个网页正文归档",
        "",
        f"- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 总页面: {len(results)}",
        f"- 正文可用或部分可用: {sum(1 for item in results if text_saved(item))}",
        f"- 错误或占位: {sum(1 for item in results if not text_saved(item))}",
        f"- 状态清单: [web_pages_archive_manifest.csv](web_pages_archive_manifest.csv)",
        "",
        "## 状态分布",
        "",
        "| 状态 | 数量 |",
        "|---|---:|",
    ]
    for status, count in sorted(Counter(item.status for item in results).items(), key=lambda item: (-item[1], item[0])):
        root_index_lines.append(f"| `{status}` | {count} |")
    root_index_lines.extend([
        "",
        "## 主题入口",
    ])
    for category in CATEGORIES:
        root_index_lines.append(f"- [{category} Markdown](md/{category}/pages/index.md) / [HTML](html/{category}/pages/index.html)")
    (root / "WEB_PAGES_ARCHIVE.md").write_text("\n".join(root_index_lines) + "\n", encoding="utf-8")

    status_rows = "".join(
        f"<tr><td>{html.escape(status)}</td><td>{count}</td></tr>"
        for status, count in sorted(Counter(item.status for item in results).items(), key=lambda item: (-item[1], item[0]))
    )
    category_rows = "".join(
        f"<tr><td>{html.escape(category)}</td><td>{len(by_category.get(category, []))}</td>"
        f"<td><a href=\"{html.escape(category, quote=True)}/pages/index.html\">HTML</a></td></tr>"
        for category in CATEGORIES
    )
    (root / "html" / "WEB_PAGES_ARCHIVE.html").write_text(
        "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        "<title>1119 个网页正文归档</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif;max-width:1080px;margin:0 auto;padding:24px;line-height:1.6;background:#f6f7f9;color:#172033}table{width:100%;border-collapse:collapse;background:#fff;margin:14px 0 28px}td,th{border:1px solid #dbe2ea;padding:9px;vertical-align:top}th{background:#eef2f7}a{color:#0f766e}</style></head><body>"
        f"<h1>1119 个网页正文归档</h1><p>总页面：{len(results)}；正文可用或部分可用：{sum(1 for item in results if text_saved(item))}；错误或占位：{sum(1 for item in results if not text_saved(item))}。</p>"
        "<h2>状态分布</h2><table><thead><tr><th>状态</th><th>数量</th></tr></thead><tbody>"
        f"{status_rows}</tbody></table><h2>主题入口</h2><table><thead><tr><th>主题</th><th>页面数</th><th>入口</th></tr></thead><tbody>{category_rows}</tbody></table></body></html>",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Archive bookmarked web pages into local Markdown and HTML files.")
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--timeout", type=int, default=12)
    parser.add_argument("--max-bytes", type=int, default=5_000_000)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--fill-missing-placeholders", action="store_true")
    args = parser.parse_args()

    root = args.root.resolve()
    socket.setdefaulttimeout(args.timeout)
    cards = parse_existing_cards(root)
    if args.limit:
        cards = cards[: args.limit]
    if args.fill_missing_placeholders:
        filled = 0
        for card in cards:
            filename = safe_filename(card.title, card.url)
            md_path = root / "md" / card.category / "pages" / f"{filename}.md"
            html_path = root / "html" / card.category / "pages" / f"{filename}.html"
            if not md_path.exists() or not html_path.exists():
                write_placeholder(card, root)
                filled += 1
        results = [archive_one(card, root, args.timeout, args.max_bytes, False) for card in cards]
        write_indexes(root, results)
        print(f"filled_placeholders={filled}")
        print(f"done total={len(results)} manifest={root / 'web_pages_archive_manifest.csv'}")
        return 0
    print(f"cards={len(cards)} workers={args.workers} timeout={args.timeout}", flush=True)
    results: list[ArchiveResult] = []
    started = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(archive_one, card, root, args.timeout, args.max_bytes, args.force) for card in cards]
        for index, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
            except Exception as exc:
                result = ArchiveResult("", "", "", "failed", "", "", "", "", 0, clean_text(str(exc))[:500])
            results.append(result)
            if index % 25 == 0 or index == len(futures):
                ok = sum(1 for item in results if item.status in {"ok", "low_text"} or item.status.startswith("http_"))
                failed = sum(1 for item in results if item.status in {"failed", "unsupported"})
                print(f"progress={index}/{len(futures)} ok_or_saved={ok} failed_or_unsupported={failed} elapsed={time.time()-started:.1f}s", flush=True)
    write_indexes(root, results)
    print(f"done total={len(results)} manifest={root / 'web_pages_archive_manifest.csv'}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
