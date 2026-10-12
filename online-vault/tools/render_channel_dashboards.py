#!/usr/bin/env python3
"""Render Web and Gemini channel dashboards with the WeChat dashboard style."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlparse


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "web-vault"
GEMINI_DIR = ROOT / "gemini-vault"
CHATGPT_DIR = ROOT / "chatgpt-vault"

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


def dump_json(value: object) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        text.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def domain_of(url: str) -> str:
    if not url:
        return "本地资料"
    parsed = urlparse(url)
    return parsed.netloc or parsed.path.split("/")[0] or "未知来源"


def rel_html_path_from_web_html(path: str) -> str:
    if not path:
        return ""
    return path.removeprefix("html/")


def rel_html_path_from_gemini_html(path: str) -> str:
    if not path:
        return ""
    return path.removeprefix("gemini-vault/html/")


def rel_html_path_from_chatgpt_html(path: str) -> str:
    if not path:
        return ""
    return path.removeprefix("chatgpt-vault/html/")


def rel_raw_path_from_chatgpt_html(path: str) -> str:
    if not path:
        return ""
    if path.startswith(("http://", "https://")):
        return path
    return "../" + path.removeprefix("chatgpt-vault/")


def rel_raw_path_from_gemini_html(path: str) -> str:
    if not path:
        return ""
    if path.startswith(("http://", "https://")):
        return path
    return "../" + path.removeprefix("gemini-vault/")


def parse_gemini_date(value: str) -> str:
    match = re.search(r"(20\d{2})年(\d{1,2})月(\d{1,2})日", value or "")
    if not match:
        return ""
    return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


def status_label(status: str) -> str:
    labels = {
        "ok": "已归档",
        "low_text": "低文本",
        "failed": "抓取失败",
        "deleted_or_unavailable": "不可用",
        "not_fetched_timeout": "超时",
        "unsupported": "不支持",
    }
    if status.startswith("http_"):
        return status.upper().replace("_", " ")
    return labels.get(status, status or "未知")


def build_web_payload() -> dict[str, object]:
    manifest = WEB_DIR / "web_pages_archive_manifest.csv"
    items = []
    with manifest.open("r", encoding="utf-8-sig", newline="") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=1):
            final_url = row.get("final_url") or row.get("url") or ""
            local_href = rel_html_path_from_web_html(row.get("html_path") or "")
            items.append(
                {
                    "index": index,
                    "title": row.get("title") or "未命名网页",
                    "category": row.get("category") or "未分类",
                    "source": domain_of(final_url),
                    "status": row.get("status") or "unknown",
                    "status_label": status_label(row.get("status") or ""),
                    "http_status": row.get("http_status") or "",
                    "href": local_href or final_url,
                    "original_url": final_url,
                    "text_chars": int(row.get("text_chars") or 0),
                    "search_text": " ".join(
                        [
                            row.get("title") or "",
                            row.get("category") or "",
                            final_url,
                            row.get("status") or "",
                            row.get("error") or "",
                        ]
                    ),
                }
            )

    category_counts = Counter(item["category"] for item in items)
    status_counts = Counter(item["status_label"] for item in items)
    readable_count = sum(1 for item in items if item["text_chars"] > 0)
    total_chars = sum(item["text_chars"] for item in items)
    return {
        "title": "Web 资料整理仪表盘",
        "generated_at": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S"),
        "meta": f"实时生成：{datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S')} · 共 {len(items)} 个网页 · {len(category_counts)} 个主题 · 可读页面 {readable_count} 个",
        "stat_1_label": "资料总数",
        "stat_1_value": str(len(items)),
        "stat_2_label": "主题数",
        "stat_2_value": str(len(category_counts)),
        "stat_3_label": "可读字符",
        "stat_3_value": f"{total_chars:,}",
        "category_counts": dict(category_counts),
        "secondary_title": "归档状态分布",
        "secondary_data": [{"name": name, "value": value} for name, value in status_counts.most_common(12)],
        "secondary_axis": [name for name, _ in status_counts.most_common(12)],
        "secondary_values": [value for _, value in status_counts.most_common(12)],
        "items": items,
        "search_placeholder": "搜索标题、主题、域名、原文链接、状态",
        "sort_options": [
            ["category", "主题顺序"],
            ["title", "标题 A-Z"],
            ["chars-desc", "字符多到少"],
            ["status", "状态"],
        ],
        "columns": ["状态", "HTTP", "主题", "标题", "来源", "原文"],
        "mode": "web",
    }


def build_chatgpt_payload() -> dict[str, object]:
    data = json.loads((CHATGPT_DIR / "search-index.json").read_text(encoding="utf-8"))
    items = []
    for index, doc in enumerate(data.get("documents", []), start=1):
        raw_href = rel_raw_path_from_chatgpt_html(doc.get("raw_href") or "")
        model = doc.get("model") or "auto"
        items.append(
            {
                "index": index,
                "title": doc.get("title") or "未命名会话",
                "category": doc.get("category") or "未分类",
                "source": model,
                "date": doc.get("updated_at") or doc.get("created_at") or doc.get("date") or "",
                "created_at": doc.get("created_at") or "",
                "updated_at": doc.get("updated_at") or doc.get("date") or "",
                "href": rel_html_path_from_chatgpt_html(doc.get("href") or ""),
                "original_url": raw_href,
                "text_chars": int(doc.get("text_chars") or 0),
                "message_count": int(doc.get("message_count") or 0),
                "attachment_count": int(doc.get("attachment_count") or 0),
                "excerpt": doc.get("excerpt") or "",
                "search_text": " ".join(
                    [
                        doc.get("title") or "",
                        doc.get("category") or "",
                        model,
                        doc.get("source_path") or "",
                        doc.get("excerpt") or "",
                        doc.get("search_text") or "",
                    ]
                ),
            }
        )

    category_counts = Counter(item["category"] for item in items)
    model_counts = Counter(item["source"] for item in items)
    dated = sorted(item["created_at"] for item in items if re.match(r"20\d{2}-\d{2}-\d{2}", item["created_at"]))
    date_range = f"{dated[0]} 至 {dated[-1]}" if dated else data.get("stats", {}).get("date_range") or "无明确时间"
    total_messages = sum(item["message_count"] for item in items)
    total_attachments = sum(item["attachment_count"] for item in items)
    generated_at = data.get("generated_at") or datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "title": "ChatGPT 会话整理仪表盘",
        "generated_at": generated_at,
        "meta": f"实时生成：{generated_at} · 共 {len(items)} 个会话 · {len(category_counts)} 个主题 · 消息 {total_messages:,} 条 · 附件 {total_attachments:,} 个",
        "stat_1_label": "会话总数",
        "stat_1_value": str(len(items)),
        "stat_2_label": "消息总数",
        "stat_2_value": f"{total_messages:,}",
        "stat_3_label": "时间范围",
        "stat_3_value": date_range,
        "category_counts": dict(category_counts),
        "secondary_title": "模型分布",
        "secondary_data": [{"name": name, "value": value} for name, value in model_counts.most_common(12)],
        "secondary_axis": [name for name, _ in model_counts.most_common(12)],
        "secondary_values": [value for _, value in model_counts.most_common(12)],
        "items": items,
        "search_placeholder": "搜索会话标题、主题、模型、摘要、正文片段",
        "sort_options": [
            ["date-new", "更新新到旧"],
            ["date-old", "更新旧到新"],
            ["messages-desc", "消息多到少"],
            ["attachments-desc", "附件多到少"],
            ["category", "主题顺序"],
            ["title", "标题 A-Z"],
            ["chars-desc", "字符多到少"],
        ],
        "columns": ["更新", "模型", "主题", "标题", "消息", "附件"],
        "mode": "chatgpt",
    }


def build_gemini_payload() -> dict[str, object]:
    data = json.loads((GEMINI_DIR / "search-index.json").read_text(encoding="utf-8"))
    items = []
    for index, doc in enumerate(data.get("documents", []), start=1):
        date_iso = parse_gemini_date(doc.get("date") or "")
        raw_href = rel_raw_path_from_gemini_html(doc.get("raw_href") or "")
        items.append(
            {
                "index": index,
                "title": doc.get("title") or "未命名资料",
                "category": doc.get("category") or "未分类",
                "source": doc.get("source_type") or "资料",
                "date": date_iso or doc.get("date") or "",
                "href": rel_html_path_from_gemini_html(doc.get("href") or ""),
                "original_url": raw_href,
                "text_chars": int(doc.get("text_chars") or 0),
                "excerpt": doc.get("excerpt") or "",
                "search_text": " ".join(
                    [
                        doc.get("title") or "",
                        doc.get("category") or "",
                        doc.get("source_type") or "",
                        doc.get("source_path") or "",
                        doc.get("excerpt") or "",
                        doc.get("search_text") or "",
                    ]
                ),
            }
        )

    category_counts = Counter(item["category"] for item in items)
    type_counts = Counter(item["source"] for item in items)
    dated = sorted(item["date"] for item in items if re.match(r"20\d{2}-\d{2}-\d{2}", item["date"]))
    date_range = f"{dated[0]} 至 {dated[-1]}" if dated else "无明确时间"
    total_chars = sum(item["text_chars"] for item in items)
    return {
        "title": "Gemini 资料整理仪表盘",
        "generated_at": data.get("generated_at") or datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S"),
        "meta": f"实时生成：{data.get('generated_at') or ''} · 共 {len(items)} 条资料 · {len(category_counts)} 个主题 · 时间范围 {date_range}",
        "stat_1_label": "资料总数",
        "stat_1_value": str(len(items)),
        "stat_2_label": "主题数",
        "stat_2_value": str(len(category_counts)),
        "stat_3_label": "时间范围",
        "stat_3_value": date_range,
        "category_counts": dict(category_counts),
        "secondary_title": "资料类型分布",
        "secondary_data": [{"name": name, "value": value} for name, value in type_counts.most_common(12)],
        "secondary_axis": [name for name, _ in type_counts.most_common(12)],
        "secondary_values": [value for _, value in type_counts.most_common(12)],
        "items": items,
        "search_placeholder": "搜索标题、主题、类型、路径、摘要",
        "sort_options": [
            ["date-new", "时间新到旧"],
            ["date-old", "时间旧到新"],
            ["category", "主题顺序"],
            ["title", "标题 A-Z"],
            ["chars-desc", "字符多到少"],
        ],
        "columns": ["日期", "类型", "主题", "标题", "字符", "原文"],
        "mode": "gemini",
    }


def category_links(payload: dict[str, object], mode: str) -> str:
    counts: dict[str, int] = payload["category_counts"]  # type: ignore[assignment]
    links = []
    for category in CATEGORIES:
        count = counts.get(category, 0)
        if not count:
            continue
        if mode == "web":
            href = f"{quote(category)}/index.html"
        else:
            href = f"?category={quote(category)}"
        links.append(f'<a href="{href}" data-category-link="{category}">{category} ({count})</a>')
    return "\n    ".join(links)


def sort_options_html(payload: dict[str, object]) -> str:
    return "".join(f'<option value="{value}">{label}</option>' for value, label in payload["sort_options"])  # type: ignore[index]


def category_options_html(payload: dict[str, object]) -> str:
    counts: dict[str, int] = payload["category_counts"]  # type: ignore[assignment]
    return "".join(
        f'<option value="{category}">{category}</option>' for category in CATEGORIES if counts.get(category, 0)
    )


def render_dashboard(payload: dict[str, object], output_path: Path) -> None:
    mode = str(payload["mode"])
    columns = payload["columns"]  # type: ignore[assignment]
    template = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__TITLE__</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    :root { color-scheme: light; --blue: #4285F4; --red: #DB4437; --yellow: #F4B400; --green: #0F9D58; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.58 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; background: #f8fafd; }
    main { max-width: 1240px; margin: 0 auto; padding: 24px 20px 60px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    a { color: #1a73e8; overflow-wrap: anywhere; }
    .meta { color: #5f6368; margin: 0 0 18px; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .stat { background: #fff; border: 1px solid #dde3ea; padding: 12px 14px; min-height: 88px; }
    .stat strong { display: block; font-size: 24px; line-height: 1.3; }
    .stat.range strong { font-size: 18px; }
    .charts { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; }
    .chart { height: 300px; background: #fff; border: 1px solid #dde3ea; }
    .native-chart { display: flex; align-items: center; justify-content: center; padding: 18px; overflow: hidden; }
    .native-chart-grid { width: 100%; display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; align-items: center; }
    .native-chart-title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #3c4043; }
    .native-donut { width: 220px; height: 220px; }
    .native-legend { display: grid; gap: 7px; max-height: 236px; overflow: auto; }
    .native-legend-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 8px; align-items: center; color: #3c4043; font-size: 13px; }
    .native-dot { width: 10px; height: 10px; border-radius: 999px; }
    .native-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .native-bars { width: 100%; display: grid; gap: 8px; }
    .native-bar-row { display: grid; grid-template-columns: 108px minmax(0, 1fr) 46px; gap: 10px; align-items: center; font-size: 13px; color: #3c4043; }
    .native-bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .native-track { height: 12px; background: #edf1f5; border-radius: 999px; overflow: hidden; }
    .native-fill { height: 100%; border-radius: 999px; min-width: 2px; }
    .native-value { text-align: right; color: #5f6368; font-variant-numeric: tabular-nums; }
    .controls { display: grid; grid-template-columns: 1fr 180px 180px; gap: 10px; margin: 18px 0 10px; }
    input, select { width: 100%; min-height: 38px; border: 1px solid #cbd5e1; background: #fff; padding: 8px 10px; font: inherit; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dde3ea; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #edf1f5; text-align: left; vertical-align: top; }
    th { position: sticky; top: 0; background: #f1f4f9; font-size: 13px; color: #4b5563; }
    .category-links { display: flex; flex-wrap: wrap; gap: 8px; }
    .category-links a { border: 1px solid #d8dee8; background: #fff; padding: 6px 9px; text-decoration: none; }
    .category-links a.active { background: #e8f0fe; border-color: #adc8ff; }
    .table-wrap { overflow-x: auto; }
    .empty { padding: 18px; color: #5f6368; background: #fff; border: 1px dashed #dde3ea; }
    @media (max-width: 780px) {
      .stats, .charts, .controls { grid-template-columns: 1fr; }
      .chart { height: 260px; }
      .native-chart-grid { grid-template-columns: 1fr; justify-items: center; }
      .native-legend { width: 100%; max-height: 120px; }
      .native-bar-row { grid-template-columns: 86px minmax(0, 1fr) 42px; }
      main { padding: 18px 12px 44px; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
<main>
  <h1>__TITLE__</h1>
  <p class="meta">__META__</p>
  <section class="stats">
    <div class="stat"><span>__STAT_1_LABEL__</span><strong>__STAT_1_VALUE__</strong></div>
    <div class="stat"><span>__STAT_2_LABEL__</span><strong>__STAT_2_VALUE__</strong></div>
    <div class="stat range"><span>__STAT_3_LABEL__</span><strong>__STAT_3_VALUE__</strong></div>
  </section>
  <section class="charts">
    <div id="categoryChart" class="chart"></div>
    <div id="secondaryChart" class="chart"></div>
  </section>
  <h2>主题二级页面</h2>
  <nav class="category-links">
    __CATEGORY_LINKS__
  </nav>
  <h2>资料检索</h2>
  <div class="controls">
    <input id="search" type="search" placeholder="__SEARCH_PLACEHOLDER__">
    <select id="category"><option value="">全部主题</option>__CATEGORY_OPTIONS__</select>
    <select id="sort">__SORT_OPTIONS__</select>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>__COL_0__</th><th>__COL_1__</th><th>__COL_2__</th><th>__COL_3__</th><th>__COL_4__</th><th>__COL_5__</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
</main>
<script>
const mode = "__MODE__";
const items = __ITEMS_JSON__;
const categoryData = __CATEGORY_DATA_JSON__;
const secondaryTitle = "__SECONDARY_TITLE__";
const secondaryAxis = __SECONDARY_AXIS_JSON__;
const secondaryValues = __SECONDARY_VALUES_JSON__;
const googleColors = ["#4285F4", "#DB4437", "#F4B400", "#0F9D58", "#AB47BC", "#00ACC1"];
const rows = document.getElementById("rows");
const search = document.getElementById("search");
const category = document.getElementById("category");
const sort = document.getElementById("sort");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function applyUrlCategory() {
  const params = new URLSearchParams(location.search);
  const selected = params.get("category");
  if (selected) category.value = selected;
  document.querySelectorAll("[data-category-link]").forEach(link => {
    if (link.dataset.categoryLink === category.value) link.classList.add("active");
  });
}

function renderRows() {
  const query = search.value.trim().toLowerCase();
  let filtered = items.filter(item => {
    const haystack = String(item.search_text || "").toLowerCase();
    return (!category.value || item.category === category.value) && (!query || haystack.includes(query));
  });
  filtered.sort((a, b) => {
    if (sort.value === "date-old") return String(a.date || "").localeCompare(String(b.date || ""));
    if (sort.value === "date-new") return String(b.date || "").localeCompare(String(a.date || ""));
    if (sort.value === "title") return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hans-CN");
    if (sort.value === "chars-desc") return Number(b.text_chars || 0) - Number(a.text_chars || 0);
    if (sort.value === "messages-desc") return Number(b.message_count || 0) - Number(a.message_count || 0);
    if (sort.value === "attachments-desc") return Number(b.attachment_count || 0) - Number(a.attachment_count || 0);
    if (sort.value === "status") return String(a.status_label || a.status || "").localeCompare(String(b.status_label || b.status || ""), "zh-Hans-CN");
    if (sort.value === "category") return String(a.category || "").localeCompare(String(b.category || ""), "zh-Hans-CN") || String(a.title || "").localeCompare(String(b.title || ""), "zh-Hans-CN");
    return Number(a.index || 0) - Number(b.index || 0);
  });
  if (!filtered.length) {
    rows.innerHTML = '<tr><td colspan="6"><div class="empty">没有匹配的资料。</div></td></tr>';
    return;
  }
  rows.innerHTML = filtered.map(item => mode === "web" ? renderWebRow(item) : (mode === "chatgpt" ? renderChatgptRow(item) : renderGeminiRow(item))).join("");
}

function renderWebRow(item) {
  const localHref = item.href || item.original_url || "#";
  const original = item.original_url ? `<a href="${esc(item.original_url)}" target="_blank" rel="noopener noreferrer">原文</a>` : "";
  return `<tr>
    <td>${esc(item.status_label || "未知")}</td>
    <td>${esc(item.http_status || "")}</td>
    <td>${esc(item.category || "未分类")}</td>
    <td><a href="${esc(localHref)}">${esc(item.title || "未命名")}</a></td>
    <td>${esc(item.source || "未知")}</td>
    <td>${original}</td>
  </tr>`;
}

function renderChatgptRow(item) {
  const localHref = item.href || "#";
  return `<tr>
    <td>${esc(item.date || "未知")}</td>
    <td>${esc(item.source || "auto")}</td>
    <td>${esc(item.category || "未分类")}</td>
    <td><a href="${esc(localHref)}">${esc(item.title || "未命名")}</a></td>
    <td>${Number(item.message_count || 0).toLocaleString()}</td>
    <td>${Number(item.attachment_count || 0).toLocaleString()}</td>
  </tr>`;
}

function renderGeminiRow(item) {
  const localHref = item.href || "#";
  const original = item.original_url ? `<a href="${esc(item.original_url)}">原文</a>` : "";
  return `<tr>
    <td>${esc(item.date || "未知")}</td>
    <td>${esc(item.source || "资料")}</td>
    <td>${esc(item.category || "未分类")}</td>
    <td><a href="${esc(localHref)}">${esc(item.title || "未命名")}</a></td>
    <td>${Number(item.text_chars || 0).toLocaleString()}</td>
    <td>${original}</td>
  </tr>`;
}

function renderCharts() {
  if (!window.echarts) {
    renderNativeDonut(document.getElementById("categoryChart"), categoryData);
    renderNativeBars(
      document.getElementById("secondaryChart"),
      secondaryAxis.map((name, index) => ({ name, value: Number(secondaryValues[index] || 0) })),
      secondaryTitle
    );
    return;
  }
  const categoryChart = echarts.init(document.getElementById("categoryChart"));
  categoryChart.setOption({
    color: googleColors,
    tooltip: { trigger: "item" },
    series: [{ type: "pie", radius: ["38%", "70%"], data: categoryData }]
  });
  const secondaryChart = echarts.init(document.getElementById("secondaryChart"));
  secondaryChart.setOption({
    color: [googleColors[0]],
    title: { text: secondaryTitle, left: 14, top: 8, textStyle: { fontSize: 13, fontWeight: 600 } },
    tooltip: { trigger: "axis" },
    grid: { left: 72, right: 18, top: 46, bottom: 46 },
    xAxis: { type: "value", minInterval: 1 },
    yAxis: { type: "category", data: secondaryAxis, inverse: true, axisLabel: { width: 96, overflow: "truncate" } },
    series: [{ type: "bar", data: secondaryValues }]
  });
  window.addEventListener("resize", () => { categoryChart.resize(); secondaryChart.resize(); });
}

function renderNativeDonut(container, data) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const circles = data.map((item, index) => {
    const value = Number(item.value || 0);
    const length = value / total * circumference;
    const circle = `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="${googleColors[index % googleColors.length]}" stroke-width="42" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 110 110)"></circle>`;
    offset += length;
    return circle;
  }).join("");
  const legend = data.map((item, index) => `<div class="native-legend-row"><span class="native-dot" style="background:${googleColors[index % googleColors.length]}"></span><span class="native-name">${esc(item.name)}</span><span>${Number(item.value || 0).toLocaleString()}</span></div>`).join("");
  container.classList.add("native-chart");
  container.innerHTML = `<div class="native-chart-grid">
    <svg class="native-donut" viewBox="0 0 220 220" role="img" aria-label="主题分布">
      <circle cx="110" cy="110" r="${radius}" fill="none" stroke="#edf1f5" stroke-width="42"></circle>
      ${circles}
      <circle cx="110" cy="110" r="42" fill="#fff"></circle>
    </svg>
    <div>
      <p class="native-chart-title">主题分布</p>
      <div class="native-legend">${legend}</div>
    </div>
  </div>`;
}

function renderNativeBars(container, data, title) {
  const maxValue = Math.max(...data.map(item => Number(item.value || 0)), 1);
  const bars = data.map((item, index) => {
    const value = Number(item.value || 0);
    const width = Math.max(2, value / maxValue * 100);
    return `<div class="native-bar-row">
      <span class="native-bar-label" title="${esc(item.name)}">${esc(item.name)}</span>
      <span class="native-track"><span class="native-fill" style="width:${width}%; background:${googleColors[index % googleColors.length]}"></span></span>
      <span class="native-value">${value.toLocaleString()}</span>
    </div>`;
  }).join("");
  container.classList.add("native-chart");
  container.innerHTML = `<div class="native-bars"><p class="native-chart-title">${esc(title)}</p>${bars}</div>`;
}

applyUrlCategory();
search.addEventListener("input", renderRows);
category.addEventListener("change", renderRows);
sort.addEventListener("change", renderRows);
renderRows();
renderCharts();
</script>
</body>
</html>
"""

    category_counts: dict[str, int] = payload["category_counts"]  # type: ignore[assignment]
    category_data = [{"name": name, "value": category_counts.get(name, 0)} for name in CATEGORIES if category_counts.get(name, 0)]
    replacements = {
        "__TITLE__": str(payload["title"]),
        "__META__": str(payload["meta"]),
        "__STAT_1_LABEL__": str(payload["stat_1_label"]),
        "__STAT_1_VALUE__": str(payload["stat_1_value"]),
        "__STAT_2_LABEL__": str(payload["stat_2_label"]),
        "__STAT_2_VALUE__": str(payload["stat_2_value"]),
        "__STAT_3_LABEL__": str(payload["stat_3_label"]),
        "__STAT_3_VALUE__": str(payload["stat_3_value"]),
        "__CATEGORY_LINKS__": category_links(payload, mode),
        "__SEARCH_PLACEHOLDER__": str(payload["search_placeholder"]),
        "__CATEGORY_OPTIONS__": category_options_html(payload),
        "__SORT_OPTIONS__": sort_options_html(payload),
        "__COL_0__": str(columns[0]),
        "__COL_1__": str(columns[1]),
        "__COL_2__": str(columns[2]),
        "__COL_3__": str(columns[3]),
        "__COL_4__": str(columns[4]),
        "__COL_5__": str(columns[5]),
        "__MODE__": mode,
        "__ITEMS_JSON__": dump_json(payload["items"]),
        "__CATEGORY_DATA_JSON__": dump_json(category_data),
        "__SECONDARY_TITLE__": str(payload["secondary_title"]),
        "__SECONDARY_AXIS_JSON__": dump_json(payload["secondary_axis"]),
        "__SECONDARY_VALUES_JSON__": dump_json(payload["secondary_values"]),
    }
    html = template
    for key, value in replacements.items():
        html = html.replace(key, value)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")


def render_web_dashboard(root: Path = ROOT) -> None:
    del root
    render_dashboard(build_web_payload(), WEB_DIR / "html" / "index.html")


def render_gemini_dashboard(root: Path = ROOT) -> None:
    del root
    render_dashboard(build_gemini_payload(), GEMINI_DIR / "html" / "index.html")


def render_chatgpt_dashboard(root: Path = ROOT) -> None:
    del root
    render_dashboard(build_chatgpt_payload(), CHATGPT_DIR / "html" / "index.html")


def main() -> None:
    render_web_dashboard()
    render_gemini_dashboard()
    render_chatgpt_dashboard()
    print("rendered web-vault/html/index.html")
    print("rendered gemini-vault/html/index.html")
    print("rendered chatgpt-vault/html/index.html")


if __name__ == "__main__":
    main()
