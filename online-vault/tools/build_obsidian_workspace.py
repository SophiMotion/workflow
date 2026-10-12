#!/usr/bin/env python3
"""Build the lightweight Obsidian workspace for online-vault.

生成 online-vault 的轻量 Obsidian 工作库；只写 2026/obsidian-workspace，不改原始资料仓。
"""

from __future__ import annotations

import json
import re
import argparse
import hashlib
import os
from datetime import date
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = ROOT.parents[1]
WORKSPACE = WORKSPACE_ROOT / "obsidian-workspace"
INDEX_PATH = ROOT / "online-vault-index.json"
SUMMARY_PATH = ROOT / "logs" / "online-vault-summary.json"

DOMAINS = [
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

PROJECTS = ["SophiCar", "SophiGo", "ProFabX", "SophMedia", "Bob", "OnlineVault"]

FOCUS_RE = re.compile(
    r"Obsidian|Codex|Claude Code|Claudian|Karpathy|LLM Wiki",
    re.I,
)
WORKFLOW_RE = re.compile(r"Hermes|AGENTS|MCP|Skills?|OpenClaw|Agent", re.I)
MATERIAL_RE = re.compile(
    r"SophiCar|SophiGo|ProFabX|SophMedia|Bob|机器人|robot|ROS|CAD|Fusion|3D|"
    r"数字制造|FabLab|Autodesk|Agent|MCP|课程|教育|选题|视频|公众号|内容",
    re.I,
)


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def ensure_workspace() -> None:
    for folder in [
        ".obsidian",
        ".agents/skills/vault-curator/agents",
        ".agents/skills/vault-curator/references",
        "00-Inbox",
        "01-Sources",
        "02-Wiki",
        "03-Projects",
        "04-Dashboards",
        "04-Dashboards/Content Pipeline",
        "90-Assets",
        "99-Templates",
    ]:
        (WORKSPACE / folder).mkdir(parents=True, exist_ok=True)


def clean_generated_files() -> None:
    """Remove files managed by this builder only. 只清理本脚本托管的生成文件。"""
    if not WORKSPACE.exists():
        return
    patterns = [
        ".DS_Store",
        ".obsidian/*.json",
        "00-Home.md",
        "00-File-Management.md",
        "00-Inbox/README.md",
        "01-Sources/*.md",
        "02-Wiki/MOC - *.md",
        "03-Projects/*.md",
        "04-Dashboards/*.base",
        "04-Dashboards/*.canvas",
        "04-Dashboards/Codex File Manager.md",
        "04-Dashboards/Content Pipeline/*.md",
        "90-Assets/*.md",
        "99-Templates/*.md",
        "AGENTS.md",
        ".agents/skills/vault-curator/SKILL.md",
        ".agents/skills/vault-curator/agents/openai.yaml",
        ".agents/skills/vault-curator/references/schema.md",
    ]
    for pattern in patterns:
        for path in WORKSPACE.glob(pattern):
            if path.is_file():
                path.unlink()


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def yaml_scalar(value: str | int | None) -> str:
    if value is None:
        return '""'
    text = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{text}"'


def yaml_list(values: Iterable[str]) -> str:
    vals = [v for v in values if v]
    if not vals:
        return "[]"
    return "[" + ", ".join(yaml_scalar(v) for v in vals) + "]"


def frontmatter(fields: dict[str, object]) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if isinstance(value, list):
            lines.append(f"{key}: {yaml_list([str(v) for v in value])}")
        else:
            lines.append(f"{key}: {yaml_scalar(value if value is not None else '')}")
    lines.append("---")
    return "\n".join(lines)


def slugify(text: str, max_len: int = 64) -> str:
    text = re.sub(r"[\\/:*?\"<>|\n\r\t]+", "-", text.strip())
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return (text[:max_len] or "untitled").strip(". ")


def one_line(text: str, max_len: int = 220) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) > max_len:
        return clean[: max_len - 1].rstrip() + "..."
    return clean


def rel_from_workspace(path: Path) -> str:
    return path.relative_to(WORKSPACE).as_posix() if path.is_relative_to(WORKSPACE) else path.as_posix()


def rel_to_workspace_abs(path: Path) -> str:
    try:
        return path.relative_to(WORKSPACE).as_posix()
    except ValueError:
        return Path(os.path.relpath(path, WORKSPACE)).as_posix()


def markdown_link_target(note_path: Path, workspace_rel: str) -> str:
    """Resolve a stored workspace-relative path for links inside a note."""
    target_abs = (WORKSPACE / workspace_rel).resolve()
    return Path(os.path.relpath(target_abs, note_path.parent)).as_posix()


def source_paths(doc: dict) -> tuple[str, str, str]:
    source_path = doc.get("source_path") or doc.get("href") or ""
    local_html = ""
    local_md = ""
    local_raw = ""
    if source_path:
        raw_path = ROOT / source_path
        local_raw = rel_to_workspace_abs(raw_path)
        if "/html/" in source_path or source_path.endswith(".html"):
            html_path = ROOT / source_path
            if html_path.exists():
                local_html = rel_to_workspace_abs(html_path)
            md_candidate = source_path.replace("/html/", "/md/")
            if md_candidate.endswith(".html"):
                md_candidate = md_candidate[:-5] + ".md"
            md_path = ROOT / md_candidate
            if md_path.exists():
                local_md = rel_to_workspace_abs(md_path)
        elif source_path.endswith(".md"):
            md_path = ROOT / source_path
            if md_path.exists():
                local_md = rel_to_workspace_abs(md_path)
    return local_md, local_html, local_raw


def infer_projects(text: str, category: str = "") -> list[str]:
    projects: list[str] = []
    hay = f"{text} {category}"
    checks = [
        ("OnlineVault", r"Obsidian|Codex|Claude Code|Claudian|Karpathy|LLM Wiki|知识库|MCP|AGENTS"),
        ("SophiCar", r"SophiCar|车|汽车|自动驾驶|无人车|ROS|机器人|移动|交通工具|AGV|AMR"),
        ("ProFabX", r"ProFabX|数字制造|FabLab|Autodesk|Fusion|CAD|CAM|3D|CNC|打印|制造"),
        ("SophiGo", r"SophiGo|部署|调度|服务|DevOps|MCP|Agent|自动化|Vite|服务器"),
        ("SophMedia", r"SophMedia|社媒|公众号|视频|剪辑|内容|选题|脚本|发布"),
        ("Bob", r"Bob|创业|孵化|产品分析|团队管理|商业|市场|融资"),
    ]
    for name, pattern in checks:
        if re.search(pattern, hay, re.I):
            projects.append(name)
    if not projects and category in {"AI工具", "工具"}:
        projects.append("OnlineVault")
    return projects[:4]


def doc_score(doc: dict) -> int:
    title = doc.get("title", "")
    text = f"{title} {doc.get('excerpt', '')} {doc.get('search_text', '')}"
    score = 0
    if FOCUS_RE.search(text):
        score += 100
    if WORKFLOW_RE.search(text):
        score += 22
    if MATERIAL_RE.search(text):
        score += 40
    category = doc.get("category", "")
    score += {
        "AI工具": 35,
        "数字制造": 32,
        "交通工具": 25,
        "FabLab": 24,
        "autodesk": 22,
        "工具": 18,
        "教育": 16,
        "产品分析": 14,
        "团队管理": 12,
        "UNNC": 10,
    }.get(category, 0)
    if doc.get("channel") == "wechat":
        score += 8
    if doc.get("channel") == "web":
        score += 6
    if doc.get("channel") == "gemini":
        score -= 6
    if doc.get("source_type") == "gemini-activity" and not FOCUS_RE.search(text):
        score -= 30
    date_text = str(doc.get("date", ""))
    if "2026" in date_text:
        score += 8
    elif "2025" in date_text:
        score += 4
    return score


def select_documents(docs: list[dict], limit: int = 90) -> list[dict]:
    selected: list[dict] = []
    seen: set[str] = set()
    channel_targets = {"wechat": 50, "web": 20, "gemini": 20}
    channel_caps = {"wechat": 58, "web": 24, "gemini": 28}
    channel_counts = {key: 0 for key in channel_caps}

    def add(doc: dict, enforce_cap: bool = True) -> bool:
        doc_id = doc.get("id") or doc.get("source_path") or doc.get("title")
        channel = doc.get("channel", "")
        if enforce_cap and channel in channel_caps and channel_counts.get(channel, 0) >= channel_caps[channel]:
            return False
        if doc_id and doc_id not in seen and len(selected) < limit:
            selected.append(doc)
            seen.add(doc_id)
            if channel in channel_counts:
                channel_counts[channel] += 1
            return True
        return False

    by_score = sorted(docs, key=doc_score, reverse=True)

    # Seed each source channel first. 首批样本要能代表 WeChat/Web/Gemini 三层来源。
    for channel, target in channel_targets.items():
        for doc in by_score:
            if doc.get("channel") != channel:
                continue
            if doc_score(doc) < 35 and channel_counts[channel] >= max(8, target // 2):
                continue
            add(doc, enforce_cap=False)
            if channel_counts[channel] >= target or len(selected) >= limit:
                break

    quotas = {
        "AI工具": 22,
        "数字制造": 14,
        "交通工具": 12,
        "FabLab": 9,
        "autodesk": 7,
        "工具": 8,
        "教育": 7,
        "产品分析": 5,
        "团队管理": 4,
        "UNNC": 4,
    }
    counts = {domain: sum(1 for d in selected if d.get("category") == domain) for domain in quotas}
    for doc in by_score:
        if doc_score(doc) < 35:
            continue
        category = doc.get("category", "")
        if counts.get(category, 999) < quotas.get(category, 0):
            add(doc)
            counts[category] = counts.get(category, 0) + 1
        if len(selected) >= limit:
            break

    for doc in by_score:
        if doc_score(doc) < 35:
            continue
        add(doc)
        if len(selected) >= limit:
            break
    return selected


def source_note_filename(doc: dict) -> str:
    title = slugify(doc.get("title", ""), 52)
    return f"{doc.get('channel', 'src')}-{doc.get('id', 'item')}-{title}.md"


def write_source_notes(selected: list[dict]) -> dict[str, str]:
    note_links: dict[str, str] = {}
    for doc in selected:
        title = doc.get("title") or "未命名资料"
        category = doc.get("category") or ""
        channel = doc.get("channel") or ""
        local_md, local_html, local_raw = source_paths(doc)
        projects = infer_projects(f"{title} {doc.get('excerpt', '')} {doc.get('search_text', '')}", category)
        tags = ["source", channel, slugify(category, 24)] + [p.lower() for p in projects]
        note_path = WORKSPACE / "01-Sources" / source_note_filename(doc)
        note_links[doc.get("id", title)] = note_path.relative_to(WORKSPACE).as_posix()

        fields = {
            "title": title,
            "channel": channel,
            "domain": category,
            "note_type": "source",
            "projects": projects,
            "status": "triaged",
            "source_type": doc.get("source_type", ""),
            "original_url": doc.get("source_url") or doc.get("raw_href") or "",
            "local_md": local_md,
            "local_html": local_html,
            "local_raw": local_raw,
            "published_at": doc.get("date", ""),
            "collected_at": doc.get("favorite_time", ""),
            "summary": one_line(doc.get("excerpt", "")),
            "related": [],
            "tags": tags,
        }
        lines = [
            frontmatter(fields),
            "",
            f"# {title}",
            "",
            f"> {one_line(doc.get('excerpt', ''), 360)}",
            "",
            "## 快速判断",
            "",
            f"- 渠道: `{channel}`",
            f"- 主题: `{category}`",
            f"- 项目: {', '.join(projects) if projects else '待判断'}",
            f"- 来源类型: `{doc.get('source_type', '')}`",
            "",
            "## 溯源",
            "",
        ]
        if fields["original_url"]:
            lines.append(f"- 原文链接: <{fields['original_url']}>")
        if local_md:
            link_target = markdown_link_target(note_path, local_md)
            lines.append(f"- 本地 Markdown: [{Path(local_md).name}](<{link_target}>)")
        if local_html:
            link_target = markdown_link_target(note_path, local_html)
            lines.append(f"- 本地 HTML: [{Path(local_html).name}](<{link_target}>)")
        if local_raw and local_raw not in {local_md, local_html}:
            link_target = markdown_link_target(note_path, local_raw)
            lines.append(f"- 本地原件: [{Path(local_raw).name}](<{link_target}>)")
        lines.extend(
            [
                "",
                "## 后续处理",
                "",
                "- [ ] 判断是否需要提炼为概念卡或项目卡",
                "- [ ] 补充有意义的双向链接",
                "- [ ] 如果用于输出，改 `status` 为 `used` 并记录产出位置",
            ]
        )
        write(note_path, "\n".join(lines))
    return note_links


def asset_score(path: Path) -> tuple[int, int]:
    text = path.as_posix()
    score = 0
    if re.search(r"Sophi|机器人|robot|AI|Fab|CAD|3d|2026|NotebookLM|Gemini|Fusion", text, re.I):
        score += 100
    if path.suffix.lower() in {".pdf", ".docx", ".pptx", ".xlsx"}:
        score += 30
    if path.suffix.lower() in {".stl", ".zip", ".mp4", ".wav", ".key", ".kmz", ".ipynb"}:
        score += 20
    return score, path.stat().st_size


def list_asset_candidates(limit: int = 50) -> list[Path]:
    exts = {".pdf", ".docx", ".pptx", ".xlsx", ".stl", ".zip", ".mp4", ".wav", ".key", ".kmz", ".ipynb", ".csv"}
    skip_exts = {".pyc", ".ds_store", ".ldb", ".bak", ".swp"}
    candidates: list[Path] = []
    for path in (ROOT / "gemini-vault").rglob("*"):
        if not path.is_file() or path.name.startswith("."):
            continue
        suffix = path.suffix.lower()
        if suffix in skip_exts:
            continue
        if suffix in exts or (suffix == "" and path.stat().st_size > 1024 * 1024):
            candidates.append(path)
    return sorted(candidates, key=asset_score, reverse=True)[:limit]


def infer_domain_from_text(text: str) -> str:
    for domain, pattern in [
        ("交通工具", r"SophiCar|汽车|车|robot|机器人|ROS|移动"),
        ("数字制造", r"CAD|3d|打印|制造|Fusion|Fab"),
        ("AI工具", r"AI|Gemini|NotebookLM|Claude|Codex|Agent"),
        ("FabLab", r"FabLab|fab"),
        ("教育", r"课程|教育|training|campus"),
    ]:
        if re.search(pattern, text, re.I):
            return domain
    return "工具"


def write_asset_notes(asset_paths: list[Path]) -> dict[str, str]:
    links: dict[str, str] = {}
    for path in asset_paths:
        title = path.stem or path.name
        rel_raw = rel_to_workspace_abs(path)
        domain = infer_domain_from_text(path.as_posix())
        projects = infer_projects(path.as_posix(), domain)
        suffix = path.suffix.lower().lstrip(".") or "no-extension"
        fingerprint = hashlib.sha1(path.relative_to(ROOT).as_posix().encode("utf-8")).hexdigest()[:8]
        note_path = WORKSPACE / "90-Assets" / f"asset-{slugify(title, 64)}-{fingerprint}.md"
        links[path.as_posix()] = note_path.relative_to(WORKSPACE).as_posix()
        fields = {
            "title": title,
            "channel": "gemini",
            "domain": domain,
            "note_type": "asset",
            "projects": projects,
            "status": "triaged",
            "source_type": f"file-{suffix}",
            "original_url": "",
            "local_md": "",
            "local_html": "",
            "local_raw": rel_raw,
            "published_at": "",
            "collected_at": "",
            "summary": f"{suffix} 原件索引；保留原件，不全量转换，按需提取摘要或截图。",
            "related": [],
            "tags": ["asset", suffix, slugify(domain, 24)] + [p.lower() for p in projects],
        }
        size_mb = path.stat().st_size / (1024 * 1024)
        link_target = markdown_link_target(note_path, rel_raw)
        lines = [
            frontmatter(fields),
            "",
            f"# {title}",
            "",
            "## 原件",
            "",
            f"- 路径: [{path.name}](<{link_target}>)",
            f"- 类型: `{suffix}`",
            f"- 大小: `{size_mb:.1f} MB`",
            f"- 项目: {', '.join(projects) if projects else '待判断'}",
            "",
            "## 处理规则",
            "",
            "- 原件保留在 `gemini-vault`，不要移动到 Obsidian 工作库。",
            "- 需要引用时，在本卡补摘要、页码、截图或关键表格位置。",
            "- 只有进入具体项目输出时，才按需转换为 Markdown、CSV 或图片摘录。",
            "",
            "## 摘要",
            "",
            "- 待 Codex 或人工补充。",
        ]
        write(note_path, "\n".join(lines))
    return links


def write_templates() -> None:
    write(
        WORKSPACE / "99-Templates" / "source-note.md",
        """---
title: ""
channel: ""
domain: ""
note_type: "source"
projects: []
status: "inbox"
source_type: ""
original_url: ""
local_md: ""
local_html: ""
local_raw: ""
published_at: ""
collected_at: ""
summary: ""
related: []
tags: []
---

# {{title}}

## 摘要

## 溯源

## 后续处理

- [ ] 判断是否需要提炼为概念卡或项目卡
- [ ] 补充有意义的双向链接
""",
    )
    write(
        WORKSPACE / "99-Templates" / "project-note.md",
        """---
title: ""
channel: "workspace"
domain: ""
note_type: "project"
projects: []
status: "linked"
source_type: "project-index"
original_url: ""
local_md: ""
local_html: ""
local_raw: ""
published_at: ""
collected_at: ""
summary: ""
related: []
tags: ["project"]
---

# {{title}}

## 项目目标

## 当前资料

## 待办事项

- [ ] 更新项目 MOC
- [ ] 提炼可复用资料包
""",
    )
    write(
        WORKSPACE / "99-Templates" / "moc-note.md",
        """---
title: ""
channel: "workspace"
domain: ""
note_type: "moc"
projects: []
status: "linked"
source_type: "moc"
original_url: ""
local_md: ""
local_html: ""
local_raw: ""
published_at: ""
collected_at: ""
summary: ""
related: []
tags: ["moc"]
---

# {{title}}

## 入口

## 核心资料

## 需要补齐
""",
    )


def write_bases() -> None:
    bases = {
        "Sources.base": """filters:
  and:
    - file.inFolder("01-Sources")
properties:
  note.title:
    displayName: 标题
  note.channel:
    displayName: 渠道
  note.domain:
    displayName: 主题
  note.projects:
    displayName: 项目
  note.status:
    displayName: 状态
  note.source_type:
    displayName: 来源类型
  note.published_at:
    displayName: 日期
views:
  - type: table
    name: 资料总表
    limit: 200
    order:
      - file.name
      - note.channel
      - note.domain
      - note.projects
      - note.status
      - note.source_type
      - note.published_at
  - type: cards
    name: 资料卡片
    limit: 80
""",
        "Projects.base": """filters:
  and:
    - file.inFolder("03-Projects")
properties:
  note.title:
    displayName: 项目
  note.projects:
    displayName: 项目标签
  note.status:
    displayName: 状态
  note.summary:
    displayName: 摘要
views:
  - type: table
    name: 项目矩阵
    order:
      - file.name
      - note.projects
      - note.status
      - note.summary
""",
        "Review Queue.base": """filters:
  or:
    - 'status == "inbox"'
    - 'status == "triaged"'
    - 'status == "stale"'
properties:
  note.title:
    displayName: 标题
  note.note_type:
    displayName: 类型
  note.channel:
    displayName: 渠道
  note.domain:
    displayName: 主题
  note.projects:
    displayName: 项目
  note.status:
    displayName: 状态
views:
  - type: table
    name: 待处理队列
    limit: 120
    order:
      - file.name
      - note.note_type
      - note.channel
      - note.domain
      - note.projects
      - note.status
""",
        "File Intake.base": """filters:
  or:
    - file.inFolder("00-Inbox")
    - 'status == "inbox"'
properties:
  note.title:
    displayName: 标题
  note.note_type:
    displayName: 类型
  note.channel:
    displayName: 渠道
  note.domain:
    displayName: 主题
  note.projects:
    displayName: 项目
  note.status:
    displayName: 状态
  note.summary:
    displayName: 摘要
views:
  - type: table
    name: 收件箱和待建卡
    limit: 80
    order:
      - file.name
      - note.note_type
      - note.channel
      - note.domain
      - note.projects
      - note.status
      - note.summary
""",
        "Assets.base": """filters:
  and:
    - file.inFolder("90-Assets")
properties:
  note.title:
    displayName: 文件
  note.domain:
    displayName: 主题
  note.projects:
    displayName: 项目
  note.source_type:
    displayName: 类型
  note.local_raw:
    displayName: 原件
  note.status:
    displayName: 状态
views:
  - type: table
    name: 资产索引
    limit: 120
    order:
      - file.name
      - note.domain
      - note.projects
      - note.source_type
      - note.local_raw
      - note.status
""",
        "Content Pipeline.base": """filters:
  and:
    - file.inFolder("04-Dashboards/Content Pipeline")
properties:
  note.title:
    displayName: 任务
  note.projects:
    displayName: 项目
  note.status:
    displayName: 状态
  note.summary:
    displayName: 说明
views:
  - type: table
    name: 内容复用流水线
    order:
      - file.name
      - note.projects
      - note.status
      - note.summary
""",
    }
    for name, content in bases.items():
        write(WORKSPACE / "04-Dashboards" / name, content)


def write_content_tasks() -> None:
    tasks = [
        ("每周收件箱整理", ["OnlineVault"], "inbox", "每周整理 00-Inbox，补齐属性并移动到合适区域。"),
        ("Obsidian Codex 选题卡", ["SophMedia", "OnlineVault"], "triaged", "把 Obsidian + Codex 工作流沉淀为教程或短视频脚本。"),
        ("SophiCar 技术资料包", ["SophiCar"], "triaged", "从交通工具、机器人、ROS、AI Agent 资料中提炼技术路线。"),
        ("数字制造课程资料包", ["ProFabX"], "triaged", "从数字制造、FabLab、Autodesk、CAD 资料中整理课程与案例。"),
        ("AI 工具周报", ["SophMedia", "OnlineVault"], "triaged", "每周从 AI工具 主题中提炼工具更新、可测试项目和观点。"),
        ("非 Markdown 资产查漏", ["OnlineVault"], "triaged", "检查 PDF/Office/STL/音视频是否已有 sidecar 摘要卡。"),
    ]
    for title, projects, status, summary in tasks:
        fields = {
            "title": title,
            "channel": "workspace",
            "domain": "工具",
            "note_type": "task",
            "projects": projects,
            "status": status,
            "source_type": "workflow-task",
            "original_url": "",
            "local_md": "",
            "local_html": "",
            "local_raw": "",
            "published_at": "",
            "collected_at": str(date.today()),
            "summary": summary,
            "related": [],
            "tags": ["task"] + [p.lower() for p in projects],
        }
        write(
            WORKSPACE / "04-Dashboards" / "Content Pipeline" / f"{slugify(title)}.md",
            f"""{frontmatter(fields)}

# {title}

## 目标

{summary}

## 下一步

- [ ] 明确输出格式
- [ ] 关联来源资料
- [ ] 生成可复用草稿
""",
        )


def write_project_pages(selected: list[dict]) -> None:
    docs_by_project: dict[str, list[dict]] = {p: [] for p in PROJECTS}
    for doc in selected:
        projects = infer_projects(f"{doc.get('title', '')} {doc.get('excerpt', '')}", doc.get("category", ""))
        for project in projects:
            docs_by_project.setdefault(project, []).append(doc)

    project_summaries = {
        "SophiCar": "智能车、机器人、自动驾驶与工程教育资料入口。",
        "SophiGo": "服务部署、调度自动化、Agent 基础设施资料入口。",
        "ProFabX": "制造工艺、数字制造、CAD/CAM/FabLab 资料入口。",
        "SophMedia": "社媒自动化、内容选题、视频脚本与资料复用入口。",
        "Bob": "项目孵化、产品分析、团队管理与商业判断入口。",
        "OnlineVault": "online-vault 本身的知识库、Obsidian、Codex 与信息整理系统入口。",
    }
    for project in PROJECTS:
        fields = {
            "title": project,
            "channel": "workspace",
            "domain": "项目",
            "note_type": "project",
            "projects": [project],
            "status": "linked",
            "source_type": "project-index",
            "original_url": "",
            "local_md": "",
            "local_html": "",
            "local_raw": "",
            "published_at": "",
            "collected_at": str(date.today()),
            "summary": project_summaries[project],
            "related": [],
            "tags": ["project", project.lower()],
        }
        lines = [
            frontmatter(fields),
            "",
            f"# {project}",
            "",
            f"> {project_summaries[project]}",
            "",
            "## 项目资料",
            "",
        ]
        linked_docs = docs_by_project.get(project, [])[:18]
        if linked_docs:
            for doc in linked_docs:
                note_name = source_note_filename(doc)
                lines.append(f"- [[{Path(note_name).stem}]] · {doc.get('category', '')} · {doc.get('channel', '')}")
        else:
            lines.append("- 暂无自动匹配资料，后续由 Codex 从 Sources.base 中补充。")
        lines.extend(
            [
                "",
                "## 工作流",
                "",
                "- [ ] 从资料卡提炼项目问题清单",
                "- [ ] 将高价值 source note 提炼为 concept note",
                "- [ ] 维护项目 MOC 和输出物链接",
            ]
        )
        write(WORKSPACE / "03-Projects" / f"{project}.md", "\n".join(lines))


def write_mocs(selected: list[dict]) -> None:
    moc_specs = [
        ("MOC - Codex Obsidian", lambda d: bool(FOCUS_RE.search(f"{d.get('title', '')} {d.get('excerpt', '')}")), "Codex、Obsidian、LLM Wiki 和知识库工作流。"),
        ("MOC - AI工具", lambda d: d.get("category") == "AI工具", "AI 工具、Agent、MCP、自动化平台和模型生态。"),
        ("MOC - 数字制造", lambda d: d.get("category") in {"数字制造", "FabLab", "autodesk"}, "数字制造、CAD、3D、FabLab 与制造工艺资料。"),
        ("MOC - SophiCar", lambda d: "SophiCar" in infer_projects(f"{d.get('title', '')} {d.get('excerpt', '')}", d.get("category", "")), "SophiCar、机器人、车载 AI 与移动平台资料。"),
        ("MOC - 内容创作与 SophMedia", lambda d: "SophMedia" in infer_projects(f"{d.get('title', '')} {d.get('excerpt', '')}", d.get("category", "")), "社媒、视频、公众号与内容流水线资料。"),
    ]
    for title, predicate, summary in moc_specs:
        docs = [d for d in selected if predicate(d)]
        fields = {
            "title": title,
            "channel": "workspace",
            "domain": "MOC",
            "note_type": "moc",
            "projects": infer_projects(title),
            "status": "linked",
            "source_type": "moc",
            "original_url": "",
            "local_md": "",
            "local_html": "",
            "local_raw": "",
            "published_at": "",
            "collected_at": str(date.today()),
            "summary": summary,
            "related": [],
            "tags": ["moc"],
        }
        lines = [
            frontmatter(fields),
            "",
            f"# {title}",
            "",
            f"> {summary}",
            "",
            "## 核心资料",
            "",
        ]
        if docs:
            for doc in docs[:28]:
                note_name = source_note_filename(doc)
                lines.append(f"- [[{Path(note_name).stem}]] · {doc.get('category', '')} · {doc.get('date', '')}")
        else:
            lines.append("- 待补充。")
        lines.extend(["", "## 需要补齐", "", "- [ ] 补概念卡", "- [ ] 补项目输出链接"])
        write(WORKSPACE / "02-Wiki" / f"{title}.md", "\n".join(lines))


def write_home(summary: dict) -> None:
    fields = {
        "title": "online-vault 工作台",
        "channel": "workspace",
        "domain": "工作台",
        "note_type": "dashboard",
        "projects": ["OnlineVault"],
        "status": "linked",
        "source_type": "dashboard",
        "original_url": "",
        "local_md": "",
        "local_html": "",
        "local_raw": "",
        "published_at": "",
        "collected_at": str(date.today()),
        "summary": "online-vault 的 Obsidian 第一屏：待处理、项目、资料库、资产和内容复用。",
        "related": [],
        "tags": ["dashboard", "onlinevault"],
    }
    channel_counts = summary.get("channel_counts", {})
    category_counts = summary.get("category_counts", {})
    top_domains = sorted(category_counts.items(), key=lambda kv: kv[1], reverse=True)[:6]
    lines = [
        frontmatter(fields),
        "",
        "# online-vault 工作台",
        "",
        "## 先做文件管理",
        "",
        "- [[00-File-Management|文件管理工作台]]",
        "- [[04-Dashboards/Codex File Manager|Codex 文件管理指令]]",
        "- 当前原则: 原始文件不移动，先用 source/asset 卡建立索引、状态和项目归属。",
        "",
        "## 快速状态",
        "",
        f"- 总资料数: `{summary.get('document_count', '')}`",
        f"- 渠道: " + " / ".join(f"{k} {v}" for k, v in channel_counts.items()),
        "- 重点主题: " + " / ".join(f"{k} {v}" for k, v in top_domains),
        "",
        "## 今日处理",
        "",
        "![[04-Dashboards/Review Queue.base]]",
        "",
        "## 项目看板",
        "",
        "![[04-Dashboards/Projects.base]]",
        "",
        "## 资料库看板",
        "",
        "![[04-Dashboards/Sources.base]]",
        "",
        "## 非 Markdown 资产",
        "",
        "![[04-Dashboards/Assets.base]]",
        "",
        "## 复用输出",
        "",
        "![[04-Dashboards/Content Pipeline.base]]",
        "",
        "## 地图",
        "",
        "- [[04-Dashboards/Online Vault Map.canvas|Online Vault Map]]",
        "- [[02-Wiki/MOC - Codex Obsidian|Codex Obsidian MOC]]",
        "- [[02-Wiki/MOC - 数字制造|数字制造 MOC]]",
    ]
    write(WORKSPACE / "00-Home.md", "\n".join(lines))


def write_file_management_pages() -> None:
    fields = {
        "title": "文件管理工作台",
        "channel": "workspace",
        "domain": "工作台",
        "note_type": "dashboard",
        "projects": ["OnlineVault"],
        "status": "linked",
        "source_type": "dashboard",
        "original_url": "",
        "local_md": "",
        "local_html": "",
        "local_raw": "",
        "published_at": "",
        "collected_at": str(date.today()),
        "summary": "online-vault 的文件管理入口：收件箱、资料卡、资产卡、项目归属和 Codex 批处理。",
        "related": ["AGENTS", "04-Dashboards/Codex File Manager"],
        "tags": ["dashboard", "file-management", "onlinevault"],
    }
    write(
        WORKSPACE / "00-File-Management.md",
        f"""{frontmatter(fields)}

# 文件管理工作台

## 今天只做三件事

1. 看 `收件箱和待建卡`，确认有没有还没有入库的材料。
2. 看 `整理队列`，每次只处理 5-10 条，不要一次打开 6000 条。
3. 把高价值资料连到项目页或 MOC，然后把 `status` 改为 `linked` 或 `used`。

## 收件箱和待建卡

![[04-Dashboards/File Intake.base]]

## 整理队列

![[04-Dashboards/Review Queue.base]]

## 资料库

![[04-Dashboards/Sources.base]]

## 非 Markdown 原件

![[04-Dashboards/Assets.base]]

## 项目落点

- [[03-Projects/SophiCar]]
- [[03-Projects/SophiGo]]
- [[03-Projects/ProFabX]]
- [[03-Projects/SophMedia]]
- [[03-Projects/Bob]]
- [[03-Projects/OnlineVault]]

## 文件处理决策

| 文件状态 | 处理方式 | 放置位置 |
|---|---|---|
| 有原始 URL 或本地 HTML/MD | 建 source note，补属性和摘要 | `01-Sources` |
| PDF、DOCX、PPTX、XLSX | 建 asset sidecar，不强转全文 | `90-Assets` |
| STL、ZIP、音视频、KEY | 保留原件，记录用途、项目、版权/敏感性 | `90-Assets` |
| 进入项目输出 | 从 source/asset 提炼到项目页或 MOC | `03-Projects` / `02-Wiki` |
| 重复、低价值、过期 | 标为 `archived` 或 `stale`，不直接删除 | 原卡保留 |

## Codex 批处理

先打开 [[04-Dashboards/Codex File Manager]]，复制其中一条指令给 Codex。默认每批 20 条以内，先列清单，再修改。
""",
    )

    playbook_fields = {
        "title": "Codex 文件管理指令",
        "channel": "workspace",
        "domain": "工具",
        "note_type": "task",
        "projects": ["OnlineVault"],
        "status": "linked",
        "source_type": "codex-playbook",
        "original_url": "",
        "local_md": "",
        "local_html": "",
        "local_raw": "",
        "published_at": "",
        "collected_at": str(date.today()),
        "summary": "配套 Codex 的 online-vault 文件管理操作指令。",
        "related": ["AGENTS", "00-File-Management"],
        "tags": ["codex", "file-management", "onlinevault"],
    }
    write(
        WORKSPACE / "04-Dashboards" / "Codex File Manager.md",
        f"""{frontmatter(playbook_fields)}

# Codex 文件管理指令

## 先盘点，不修改

```text
使用 $vault-curator 检查 /Users/wubo/Documents/2026-2/obsidian-workspace 的 Review Queue，列出前 20 条待整理资料。先不要修改文件，只给出每条的 channel、domain、projects、status、原始链接是否完整，以及建议处理动作。
```

## 整理一批资料卡

```text
使用 $vault-curator 整理 Review Queue 前 20 条资料卡。要求：保留 original_url/local_md/local_html/local_raw；补 summary、projects、related；能连到项目页或 MOC 的加双链；完成后把 status 从 triaged 改为 linked。不要移动或删除 raw vault 原件。
```

## 处理非 Markdown 原件

```text
使用 $vault-curator 检查 90-Assets 前 20 张资产卡。给每张卡补用途、项目归属、是否需要摘要、是否需要转 CSV/Markdown/截图。不要全量转换 PDF/DOCX/PPTX，除非我明确指定某个文件。
```

## 按项目聚合

```text
使用 $vault-curator 汇总 SophiCar 相关资料。读取 projects 包含 SophiCar 的 source/asset 卡，更新 03-Projects/SophiCar.md：按机器人/ROS/车载 AI/硬件/课程资料分类列出关键来源，每条保留链接。
```

## 健康检查

```text
使用 $vault-curator 对 /Users/wubo/Documents/2026-2/obsidian-workspace 做健康检查：找出缺少 original_url/local_md/local_html/local_raw 的 source notes、缺少 local_raw 的 asset notes、断链、孤儿 MOC、长期 triaged 或 stale 的资料。先输出报告，不修改文件。
```

## 新资料入库

```text
使用 $vault-curator 将 00-Inbox 中的新资料入库。网页或文章建 source note；PDF/DOCX/PPTX/XLSX/STL/ZIP/音视频建 asset sidecar；所有 AI 判断写入 summary/status/projects/related，不覆盖原文，不移动 raw vault。
```
""",
    )


def write_canvas() -> None:
    canvas = {
        "nodes": [
            {"id": "home", "type": "file", "file": "00-Home.md", "x": 0, "y": 0, "width": 360, "height": 220},
            {"id": "sources", "type": "file", "file": "04-Dashboards/Sources.base", "x": -460, "y": 0, "width": 360, "height": 220},
            {"id": "projects", "type": "file", "file": "04-Dashboards/Projects.base", "x": 460, "y": 0, "width": 360, "height": 220},
            {"id": "assets", "type": "file", "file": "04-Dashboards/Assets.base", "x": 0, "y": 300, "width": 360, "height": 220},
            {"id": "review", "type": "file", "file": "04-Dashboards/Review Queue.base", "x": 0, "y": -300, "width": 360, "height": 220},
            {"id": "raw", "type": "text", "text": "原始证据层\\nweb-vault / wechat-vault / gemini-vault\\n默认不移动、不覆盖", "x": -460, "y": 300, "width": 360, "height": 220},
            {"id": "codex", "type": "file", "file": "AGENTS.md", "x": 460, "y": 300, "width": 360, "height": 220},
        ],
        "edges": [
            {"id": "e1", "fromNode": "home", "toNode": "sources"},
            {"id": "e2", "fromNode": "home", "toNode": "projects"},
            {"id": "e3", "fromNode": "home", "toNode": "assets"},
            {"id": "e4", "fromNode": "home", "toNode": "review"},
            {"id": "e5", "fromNode": "sources", "toNode": "raw", "label": "引用"},
            {"id": "e6", "fromNode": "codex", "toNode": "home", "label": "维护"},
        ],
    }
    write(WORKSPACE / "04-Dashboards" / "Online Vault Map.canvas", json.dumps(canvas, ensure_ascii=False, indent=2))


def write_agents() -> None:
    write(
        WORKSPACE / "AGENTS.md",
        """# AGENTS.md — online-vault Obsidian 工作库

本目录是 `online-vault` 的轻量 Obsidian 工作库。中文交互，原始证据层保留在 `../Social media/online-vault/`。

## 边界

- 默认只编辑本目录：`/Users/wubo/Documents/2026-2/obsidian-workspace/`。
- 不删除、不移动、不重命名 `../Social media/online-vault/web-vault`、`../Social media/online-vault/wechat-vault`、`../Social media/online-vault/gemini-vault`。
- 原始资料只通过 `original_url`、`local_md`、`local_html`、`local_raw` 引用。
- 批量整理前先列清单；每批 20-50 篇，避免一次扫 6000 篇。
- AI 判断写入 `summary`、`status`、`projects`、`related`，不要覆盖原文。

## 目录职责

- `00-Inbox/`：待处理输入和临时记录。
- `01-Sources/`：精选资料卡，必须可追溯到原文或本地原件。
- `02-Wiki/`：MOC、概念卡、主题导航。
- `03-Projects/`：项目入口和项目资料矩阵。
- `04-Dashboards/`：Home 可嵌入的 `.base`、`.canvas` 和内容流水线。
- `90-Assets/`：PDF、Office、STL、ZIP、音视频等非 Markdown 原件的 sidecar 摘要卡。
- `99-Templates/`：Obsidian 模板。

## 属性规范

每篇工作笔记使用扁平 YAML，不写嵌套对象：

```yaml
---
title: ""
channel: ""
domain: ""
note_type: "source"
projects: []
status: "inbox"
source_type: ""
original_url: ""
local_md: ""
local_html: ""
local_raw: ""
published_at: ""
collected_at: ""
summary: ""
related: []
tags: []
---
```

## 工作流

1. 新资料先入 `00-Inbox/` 或生成 source/asset sidecar。
2. 补齐 frontmatter，保留溯源字段。
3. 判断 `projects` 和 `domain`，不要只靠文件夹分类。
4. 值得复用的资料提炼为 `02-Wiki/` 概念卡或 `03-Projects/` 项目段落。
5. 更新相关 MOC，并检查 `04-Dashboards/*.base` 能覆盖新资料。
6. 完成后把 `status` 从 `inbox/triaged` 改为 `distilled/linked/used`。

## 文件管理协议

- 先索引，后整理；先 sidecar，后转换；先列清单，后批量修改。
- 每次批处理默认 20 条以内，除非用户明确要求扩大范围。
- 删除、移动、重命名原始文件前必须单独确认。
- 对重复、低价值、过期资料优先标记 `archived` 或 `stale`，不要直接删除。
- 项目归属写入 `projects` 字段；主题归属写入 `domain` 字段；不要用新增文件夹解决分类冲突。
- 文件管理入口是 `00-File-Management.md`，Codex 操作指令在 `04-Dashboards/Codex File Manager.md`。

## 安全

- 不处理 `.env`、密钥、数据库解密文件或私人聊天原文，除非用户明确要求。
- 非 Markdown 文件不全量转换；先建立 sidecar，只有进入项目输出时再按需转换。
- 大批量操作必须先 dry-run 或输出候选清单。
""",
    )


def write_skill() -> None:
    skill_dir = WORKSPACE / ".agents" / "skills" / "vault-curator"
    write(
        skill_dir / "SKILL.md",
        """---
name: vault-curator
description: Curate the online-vault Obsidian workspace. Use when Codex needs to intake source notes, normalize flat YAML properties, preserve original_url/local_md/local_html/local_raw provenance, create or update sidecar asset notes for non-Markdown files, maintain MOC notes, refresh Bases dashboards, or run health checks inside /Users/wubo/Documents/2026-2/obsidian-workspace.
---

# Vault Curator

Use this skill only inside `/Users/wubo/Documents/2026-2/obsidian-workspace`.

## Workflow

1. Read `AGENTS.md` first and obey the raw-vault boundary.
2. Inspect the target files or candidate list before editing.
3. Process batches of 20-50 notes unless the user asks for fewer.
4. Keep source notes traceable: never remove `original_url`, `local_md`, `local_html`, or `local_raw`.
5. Keep frontmatter flat; do not add nested YAML objects.
6. Update affected MOC notes in `02-Wiki/` and project pages in `03-Projects/`.
7. Check dashboards in `04-Dashboards/` still use `file.inFolder(...)` or simple property filters.

## Status Rules

- `inbox`: captured but not reviewed.
- `triaged`: classified and traceable, not yet distilled.
- `distilled`: key points extracted into summary/concept/project notes.
- `linked`: connected to MOC/project pages.
- `used`: already used in output.
- `archived`: kept only for evidence.
- `stale`: needs source/date verification.

## Non-Markdown Assets

For PDF, DOCX, PPTX, XLSX, STL, ZIP, KEY, audio, video, and no-extension files:

- Create or update a sidecar note in `90-Assets/`.
- Link the original through `local_raw`.
- Add only summary, page/sheet/slide references, and project relevance.
- Do not copy the raw file into the workspace unless the user explicitly asks.

## Health Check

Report:

- source notes missing provenance fields
- assets missing `local_raw`
- notes with nested YAML or missing `note_type`
- stale/inbox/triaged counts
- orphan MOCs or project pages that need update

For the expected schema and examples, read `references/schema.md` when needed.
""",
    )
    write(
        skill_dir / "references" / "schema.md",
        """# online-vault Obsidian Schema

Required flat properties:

```yaml
title: ""
channel: ""
domain: ""
note_type: "source"
projects: []
status: "inbox"
source_type: ""
original_url: ""
local_md: ""
local_html: ""
local_raw: ""
published_at: ""
collected_at: ""
summary: ""
related: []
tags: []
```

Allowed `channel`: `web`, `wechat`, `gemini`, `chatgpt`, `codex`, `workspace`.

Allowed `note_type`: `source`, `concept`, `project`, `person`, `org`, `task`, `moc`, `asset`, `dashboard`.

Allowed `status`: `inbox`, `triaged`, `distilled`, `linked`, `used`, `archived`, `stale`.

Allowed projects: `SophiCar`, `SophiGo`, `ProFabX`, `SophMedia`, `Bob`, `OnlineVault`.

Keep `domain` aligned with the existing 13 online-vault topics when possible:
社区、数字制造、交通工具、UNNC、团队管理、工具、产品分析、FabLab、autodesk、HIL、AI工具、政策、教育。
""",
    )
    write(
        skill_dir / "agents" / "openai.yaml",
        """interface:
  display_name: "Vault Curator"
  short_description: "整理 online-vault 的 Obsidian 工作库"
  default_prompt: "使用 $vault-curator 整理 /Users/wubo/Documents/2026-2/obsidian-workspace 的收件箱、资料卡、MOC 和 Bases。"
""",
    )


def write_obsidian_config() -> None:
    write(WORKSPACE / ".obsidian" / "app.json", json.dumps({"promptDelete": False}, indent=2))
    core_plugins = {
        "file-explorer": True,
        "global-search": True,
        "switcher": True,
        "graph": True,
        "backlink": True,
        "canvas": True,
        "outgoing-link": True,
        "tag-pane": True,
        "properties": True,
        "page-preview": True,
        "daily-notes": True,
        "templates": True,
        "command-palette": True,
        "bookmarks": True,
        "outline": True,
        "word-count": True,
        "file-recovery": True,
        "bases": True,
    }
    write(WORKSPACE / ".obsidian" / "core-plugins.json", json.dumps(core_plugins, ensure_ascii=False, indent=2))
    write(
        WORKSPACE / ".obsidian" / "templates.json",
        json.dumps({"folder": "99-Templates", "dateFormat": "YYYY-MM-DD", "timeFormat": "HH:mm"}, ensure_ascii=False, indent=2),
    )


def write_readmes(selected: list[dict], assets: list[Path]) -> None:
    write(
        WORKSPACE / "00-Inbox" / "README.md",
        "# 00-Inbox\n\n临时输入区。新增资料先放这里，整理后移动到 `01-Sources`、`02-Wiki`、`03-Projects` 或 `90-Assets`。\n",
    )
    write(
        WORKSPACE / "01-Sources" / "README.md",
        f"# 01-Sources\n\n首批已生成 `{len(selected)}` 张精选资料卡。每张卡必须保留原文或本地路径。\n",
    )
    write(
        WORKSPACE / "90-Assets" / "README.md",
        f"# 90-Assets\n\n首批已生成 `{len(assets)}` 张非 Markdown 原件 sidecar 卡。原件仍保留在 `../Social media/online-vault/gemini-vault`。\n",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build online-vault Obsidian workspace")
    parser.add_argument("--fresh", action="store_true", help="refresh files generated by this script")
    args = parser.parse_args()

    if args.fresh:
        clean_generated_files()
    ensure_workspace()
    index = read_json(INDEX_PATH)
    summary = read_json(SUMMARY_PATH)
    docs = index.get("documents", [])
    selected = select_documents(docs, 90)
    assets = list_asset_candidates(50)

    write_obsidian_config()
    write_templates()
    write_source_notes(selected)
    write_asset_notes(assets)
    write_bases()
    write_content_tasks()
    write_project_pages(selected)
    write_mocs(selected)
    write_home(summary)
    write_file_management_pages()
    write_canvas()
    write_agents()
    write_skill()
    write_readmes(selected, assets)

    print(f"workspace={WORKSPACE}")
    print(f"source_notes={len(selected)}")
    print(f"asset_notes={len(assets)}")


if __name__ == "__main__":
    main()
