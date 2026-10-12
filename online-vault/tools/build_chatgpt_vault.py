#!/usr/bin/env python3
"""Build a searchable dashboard from a ChatGPT data export."""

from __future__ import annotations

import hashlib
import html as html_lib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote


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

CHATGPT_CHANNEL_LABEL = "ChatGPT"
SEARCH_TEXT_LIMIT = 5000
PAGE_TEXT_LIMIT = 80000
DISPLAY_TEXT_LIMIT = 20000

SKIP_CONTENT_TYPES = {"thoughts", "reasoning_recap"}
ROLE_LABELS = {
    "user": "User",
    "assistant": "Assistant",
    "system": "System",
    "tool": "Tool",
}

CATEGORY_KEYWORDS: dict[str, list[tuple[str, int]]] = {
    "autodesk": [
        ("autodesk", 12),
        ("fusion 360", 12),
        ("fusion360", 12),
        ("inventor", 9),
        ("revit", 8),
        ("forge", 7),
        ("aps", 6),
    ],
    "HIL": [
        ("hil", 12),
        ("hardware in loop", 12),
        ("hardware-in-loop", 12),
        ("硬件在环", 12),
        ("sim-to-real", 7),
        ("isaac sim", 5),
        ("仿真", 4),
    ],
    "UNNC": [
        ("unnc", 12),
        ("宁波诺丁汉", 12),
        ("nottingham", 9),
    ],
    "FabLab": [
        ("fablab", 12),
        ("fab lab", 12),
        ("fab academy", 12),
        ("fab foundation", 9),
        ("makerspace", 8),
        ("nexmaker", 8),
        ("创客", 6),
    ],
    "交通工具": [
        ("sophicar", 12),
        ("agv", 10),
        ("ros", 8),
        ("mobile robot", 8),
        ("移动机器人", 9),
        ("robot", 5),
        ("机器人", 6),
        ("小车", 7),
        ("底盘", 7),
        ("chassis", 7),
        ("vehicle", 7),
        ("汽车", 7),
        ("自动驾驶", 7),
        ("无人驾驶", 7),
        ("esp32", 4),
        ("arduino", 4),
        ("电机", 5),
        ("蓝牙", 4),
    ],
    "数字制造": [
        ("profabx", 12),
        ("digital fabrication", 12),
        ("数字制造", 12),
        ("manufacturing", 7),
        ("fabrication", 7),
        ("3d printing", 9),
        ("3d打印", 9),
        ("additive", 7),
        ("cad", 6),
        ("cam", 6),
        ("cnc", 7),
        ("dfm", 7),
        ("stl", 6),
        ("openscad", 7),
        ("参数化", 7),
        ("机械设计", 7),
        ("机加工", 7),
        ("钛合金", 6),
    ],
    "教育": [
        ("sophilab", 12),
        ("education", 9),
        ("课程", 9),
        ("教学", 8),
        ("教育", 8),
        ("学生", 7),
        ("高中", 6),
        ("curriculum", 8),
        ("training", 5),
        ("pbl", 5),
        ("雅思", 5),
    ],
    "AI工具": [
        ("chatgpt", 10),
        ("openai", 10),
        ("claude", 9),
        ("codex", 9),
        ("gemini", 8),
        ("deepseek", 8),
        ("qwen", 7),
        ("llm", 8),
        ("agent", 8),
        ("rag", 8),
        ("prompt", 7),
        ("提示词", 8),
        ("模型", 5),
        ("mcp", 6),
        ("notebooklm", 8),
    ],
    "产品分析": [
        ("business plan", 12),
        ("商业计划", 12),
        ("商业模式", 9),
        ("市场", 7),
        ("融资", 9),
        ("创业", 7),
        ("竞品", 8),
        ("定价", 8),
        ("产品", 4),
        ("pitch", 6),
    ],
    "团队管理": [
        ("招聘", 9),
        ("团队", 8),
        ("组织", 8),
        ("管理", 6),
        ("工作流", 7),
        ("流程", 5),
        ("战略", 6),
        ("okr", 5),
    ],
    "政策": [
        ("政策", 12),
        ("政府", 9),
        ("申报", 8),
        ("补贴", 8),
        ("招标", 7),
        ("采购", 5),
    ],
    "工具": [
        ("python", 8),
        ("javascript", 8),
        ("typescript", 7),
        ("html", 6),
        ("css", 6),
        ("api", 6),
        ("代码", 6),
        ("脚本", 7),
        ("debug", 7),
        ("error", 5),
        ("错误", 5),
        ("npm", 6),
        ("git", 5),
        ("hexo", 7),
        ("keynote", 5),
        ("logo", 4),
    ],
    "社区": [
        ("community", 5),
        ("社区", 6),
        ("活动", 5),
        ("分享", 4),
        ("宗谱", 5),
    ],
}

TIE_PRIORITY = [
    "autodesk",
    "HIL",
    "UNNC",
    "FabLab",
    "交通工具",
    "数字制造",
    "教育",
    "AI工具",
    "产品分析",
    "团队管理",
    "政策",
    "工具",
    "社区",
]


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("\u00a0", " ").replace("\ufeff", "")
    value = re.sub(r"[ \t\r\f\v]+", " ", value)
    value = re.sub(r"\n\s*", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", clean_text(value)).strip()


def truncate(value: str | None, limit: int) -> str:
    value = clean_text(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def excerpt(value: str | None, limit: int = 260) -> str:
    return truncate(compact(value), limit)


def dump_json(value: object) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        text.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_js(path: Path, variable: str, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"window.{variable} = {dump_json(data)};\n", encoding="utf-8")


def stable_id(prefix: str, seed: str) -> str:
    return f"{prefix}-{hashlib.sha1(seed.encode('utf-8')).hexdigest()[:12]}"


def path_href(path: str | Path) -> str:
    if isinstance(path, Path):
        path = path.as_posix()
    return quote(path, safe="/:#?&=%-_.~")


def timestamp_to_date(value: float | int | None) -> str:
    if not value:
        return ""
    try:
        return datetime.fromtimestamp(float(value)).astimezone().strftime("%Y-%m-%d")
    except (OSError, OverflowError, ValueError):
        return ""


def timestamp_to_datetime(value: float | int | None) -> str:
    if not value:
        return ""
    try:
        return datetime.fromtimestamp(float(value)).astimezone().strftime("%Y-%m-%d %H:%M")
    except (OSError, OverflowError, ValueError):
        return ""


def latest_export_dir(root: Path) -> Path | None:
    chatgpt_dir = root / "chatgpt-vault"
    candidates = []
    for path in chatgpt_dir.iterdir() if chatgpt_dir.exists() else []:
        if path.is_dir() and list(path.glob("conversations-*.json")):
            candidates.append(path)
    if not candidates:
        return None
    return max(candidates, key=lambda item: item.stat().st_mtime)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def load_conversations(export_dir: Path) -> list[dict[str, Any]]:
    conversations: list[dict[str, Any]] = []
    for path in sorted(export_dir.glob("conversations-*.json")):
        data = load_json(path, [])
        if isinstance(data, list):
            conversations.extend(item for item in data if isinstance(item, dict))
    return conversations


def attachment_file_lookup(export_dir: Path) -> dict[str, dict[str, Any]]:
    names = load_json(export_dir / "conversation_asset_file_names.json", {})
    files: dict[str, dict[str, Any]] = {}
    if isinstance(names, dict):
        for dat_name, original_name in names.items():
            file_id = dat_name[:-4] if dat_name.endswith(".dat") else dat_name
            dat_path = export_dir / dat_name
            files[file_id] = {
                "id": file_id,
                "name": original_name or dat_name,
                "raw_file": dat_name,
                "raw_path": f"chatgpt-vault/{export_dir.name}/{dat_name}",
                "size": dat_path.stat().st_size if dat_path.exists() else 0,
            }
    library_files = load_json(export_dir / "library_files.json", [])
    if isinstance(library_files, list):
        for item in library_files:
            if not isinstance(item, dict):
                continue
            file_id = item.get("file_id") or item.get("id")
            if not file_id:
                continue
            dat_name = f"{file_id}.dat"
            dat_path = export_dir / dat_name
            files.setdefault(file_id, {})
            files[file_id].update(
                {
                    "id": file_id,
                    "name": item.get("file_name") or files[file_id].get("name") or dat_name,
                    "raw_file": dat_name if dat_path.exists() else files[file_id].get("raw_file", ""),
                    "raw_path": f"chatgpt-vault/{export_dir.name}/{dat_name}" if dat_path.exists() else files[file_id].get("raw_path", ""),
                    "size": item.get("file_size_bytes") or files[file_id].get("size", 0),
                    "mime_type": item.get("mime_type") or files[file_id].get("mime_type", ""),
                    "extension": item.get("file_extension") or files[file_id].get("extension", ""),
                    "created_at": item.get("created_at") or "",
                }
            )
    return files


def part_to_text(part: Any) -> str:
    if isinstance(part, str):
        return part
    if not isinstance(part, dict):
        return ""
    if isinstance(part.get("text"), str):
        return part["text"]
    if isinstance(part.get("content"), str):
        return part["content"]
    asset_id = part.get("asset_pointer") or part.get("file_id") or part.get("id")
    if asset_id:
        return f"[附件: {asset_id}]"
    return ""


def message_text(message: dict[str, Any]) -> str:
    content = message.get("content") or {}
    if not isinstance(content, dict):
        return ""
    content_type = content.get("content_type") or ""
    if content_type in SKIP_CONTENT_TYPES:
        return ""
    parts = content.get("parts")
    if isinstance(parts, list):
        return clean_text("\n".join(part_to_text(part) for part in parts if part_to_text(part)))
    if isinstance(content.get("text"), str):
        return clean_text(content["text"])
    return ""


def message_model(message: dict[str, Any], default_model: str = "") -> str:
    metadata = message.get("metadata") or {}
    if isinstance(metadata, dict):
        return metadata.get("model_slug") or metadata.get("default_model_slug") or default_model or ""
    return default_model or ""


def sorted_messages(conversation: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    mapping = conversation.get("mapping") or {}
    if not isinstance(mapping, dict):
        return rows
    for node in mapping.values():
        if not isinstance(node, dict):
            continue
        message = node.get("message")
        if not isinstance(message, dict):
            continue
        text = message_text(message)
        role = (message.get("author") or {}).get("role") or "unknown"
        metadata = message.get("metadata") or {}
        rows.append(
            {
                "id": message.get("id") or node.get("id") or "",
                "node_id": node.get("id") or "",
                "parent": node.get("parent") or (metadata.get("parent_id") if isinstance(metadata, dict) else "") or "",
                "role": role,
                "role_label": ROLE_LABELS.get(role, role.title()),
                "text": text,
                "create_time": message.get("create_time") or 0,
                "created_at": timestamp_to_datetime(message.get("create_time")),
                "content_type": (message.get("content") or {}).get("content_type") if isinstance(message.get("content"), dict) else "",
                "model": message_model(message, conversation.get("default_model_slug") or ""),
                "message": message,
            }
        )
    rows.sort(key=lambda item: (float(item.get("create_time") or 0), item.get("id") or ""))
    return rows


def primary_messages(conversation: dict[str, Any], all_messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapping = conversation.get("mapping") or {}
    current = conversation.get("current_node")
    path_ids: list[str] = []
    seen: set[str] = set()
    while current and current not in seen and isinstance(mapping, dict) and current in mapping:
        seen.add(current)
        path_ids.append(current)
        node = mapping.get(current) or {}
        current = node.get("parent") if isinstance(node, dict) else None
    path_ids.reverse()
    by_node = {item.get("node_id"): item for item in all_messages}
    primary = [by_node[node_id] for node_id in path_ids if node_id in by_node and by_node[node_id].get("text")]
    if len(primary) >= 2:
        return primary
    return [item for item in all_messages if item.get("text")]


def message_attachments(message: dict[str, Any], file_lookup: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    metadata = message.get("metadata") or {}
    attachments = metadata.get("attachments") if isinstance(metadata, dict) else None
    rows: list[dict[str, Any]] = []
    if not isinstance(attachments, list):
        return rows
    for item in attachments:
        if not isinstance(item, dict):
            continue
        file_id = item.get("id") or item.get("file_id") or ""
        known = file_lookup.get(file_id, {}) if file_id else {}
        name = item.get("name") or known.get("name") or file_id or "未命名附件"
        rows.append(
            {
                "id": file_id,
                "name": name,
                "size": item.get("size") or known.get("size") or 0,
                "mime_type": item.get("mime_type") or known.get("mime_type") or "",
                "width": item.get("width") or 0,
                "height": item.get("height") or 0,
                "raw_path": known.get("raw_path") or "",
            }
        )
    return rows


def conversation_attachments(messages: list[dict[str, Any]], file_lookup: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for item in messages:
        message = item.get("message")
        if not isinstance(message, dict):
            continue
        for attachment in message_attachments(message, file_lookup):
            key = attachment.get("id") or attachment.get("name") or json.dumps(attachment, sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            rows.append(attachment)
    return rows


def classify_chatgpt(title: str, text: str) -> str:
    haystack = f"{title}\n{text[:25000]}".lower()
    scores: Counter[str] = Counter()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword, weight in keywords:
            count = haystack.count(keyword.lower())
            if count:
                scores[category] += min(count, 6) * weight
    if not scores:
        return "社区"
    best = max(scores.values())
    winners = [category for category, score in scores.items() if score == best]
    for category in TIE_PRIORITY:
        if category in winners:
            return category
    return winners[0]


def transcript_for(messages: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for item in messages:
        text = truncate(item.get("text") or "", DISPLAY_TEXT_LIMIT)
        if not text:
            continue
        when = item.get("created_at") or "未知时间"
        role = item.get("role_label") or item.get("role") or "Message"
        model = item.get("model") or ""
        suffix = f" · {model}" if model and role == "Assistant" else ""
        parts.append(f"{role} · {when}{suffix}\n{text}")
    return truncate(clean_text("\n\n---\n\n".join(parts)), PAGE_TEXT_LIMIT)


def search_text_for(title: str, messages: list[dict[str, Any]], attachments: list[dict[str, Any]]) -> str:
    parts = [title]
    for item in messages:
        if item.get("text"):
            parts.append(str(item["text"])[:4000])
    for attachment in attachments:
        parts.append(str(attachment.get("name") or ""))
    return truncate("\n".join(parts), SEARCH_TEXT_LIMIT)


def public_doc(doc: dict[str, Any]) -> dict[str, Any]:
    clone = dict(doc)
    clone.pop("body", None)
    clone.pop("attachments", None)
    return clone


def summary_for_docs(docs: list[dict[str, Any]]) -> dict[str, Any]:
    category_counts = Counter(doc["category"] for doc in docs)
    model_counts = Counter(doc.get("model") or "unknown" for doc in docs)
    return {
        "generated_at": now_iso(),
        "document_count": len(docs),
        "channel_counts": {"chatgpt": len(docs)},
        "category_counts": {category: category_counts.get(category, 0) for category in CATEGORIES},
        "model_counts": dict(model_counts),
        "message_count": sum(int(doc.get("message_count") or 0) for doc in docs),
        "attachment_count": sum(int(doc.get("attachment_count") or 0) for doc in docs),
    }


def build_chatgpt_docs(root: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    export_dir = latest_export_dir(root)
    if not export_dir:
        return [], {"errors": ["No ChatGPT export directory found"]}

    conversations = load_conversations(export_dir)
    file_lookup = attachment_file_lookup(export_dir)
    docs: list[dict[str, Any]] = []
    role_counts: Counter[str] = Counter()
    content_type_counts: Counter[str] = Counter()
    model_counts: Counter[str] = Counter()
    month_counts: Counter[str] = Counter()
    errors: list[dict[str, str]] = []

    for index, conversation in enumerate(conversations, start=1):
        try:
            all_messages = sorted_messages(conversation)
            visible_messages = [item for item in all_messages if item.get("text")]
            primary = primary_messages(conversation, all_messages)
            attachments = conversation_attachments(all_messages, file_lookup)
            for item in all_messages:
                role_counts[item.get("role") or "unknown"] += 1
                content_type_counts[item.get("content_type") or "unknown"] += 1
                if item.get("model"):
                    model_counts[item["model"]] += 1
            created_at = timestamp_to_date(conversation.get("create_time"))
            updated_at = timestamp_to_date(conversation.get("update_time"))
            if created_at:
                month_counts[created_at[:7]] += 1
            first_user = next((item.get("text") for item in visible_messages if item.get("role") == "user" and item.get("text")), "")
            raw_title = compact(conversation.get("title"))
            title = raw_title if raw_title and raw_title != "New chat" else excerpt(first_user, 90) or "未命名 ChatGPT 会话"
            body = transcript_for(primary)
            full_search = search_text_for(title, visible_messages, attachments)
            category = classify_chatgpt(title, full_search)
            assistant_models = [item.get("model") for item in all_messages if item.get("role") == "assistant" and item.get("model")]
            model = Counter(assistant_models).most_common(1)[0][0] if assistant_models else conversation.get("default_model_slug") or "auto"
            doc_id = stable_id("chatgpt", conversation.get("conversation_id") or conversation.get("id") or f"{index}:{title}")
            rel_export = export_dir.relative_to(root)
            docs.append(
                {
                    "id": doc_id,
                    "conversation_id": conversation.get("conversation_id") or conversation.get("id") or "",
                    "channel": "chatgpt",
                    "channel_label": CHATGPT_CHANNEL_LABEL,
                    "category": category,
                    "title": truncate(title, 180),
                    "href": f"chatgpt-vault/html/items/{doc_id}.html",
                    "raw_href": path_href(rel_export / "chat.html"),
                    "source_path": f"{rel_export.as_posix()}/conversations.json#{conversation.get('conversation_id') or conversation.get('id') or index}",
                    "source_url": "",
                    "source_type": "chatgpt-conversation",
                    "date": updated_at or created_at,
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "created_at_full": timestamp_to_datetime(conversation.get("create_time")),
                    "updated_at_full": timestamp_to_datetime(conversation.get("update_time")),
                    "excerpt": excerpt(first_user or body),
                    "search_text": full_search,
                    "text_chars": sum(len(item.get("text") or "") for item in visible_messages),
                    "message_count": len(all_messages),
                    "visible_message_count": len(visible_messages),
                    "user_messages": sum(1 for item in all_messages if item.get("role") == "user"),
                    "assistant_messages": sum(1 for item in all_messages if item.get("role") == "assistant"),
                    "attachment_count": len(attachments),
                    "attachments": attachments,
                    "model": model,
                    "is_starred": bool(conversation.get("is_starred")),
                    "is_archived": bool(conversation.get("is_archived")),
                    "body": body,
                }
            )
        except Exception as exc:  # pragma: no cover - defensive export parsing
            errors.append({"conversation": str(conversation.get("conversation_id") or index), "error": str(exc)})

    dates = sorted(doc["created_at"] for doc in docs if doc.get("created_at"))
    stats = {
        "export_dir": export_dir.relative_to(root).as_posix(),
        "conversation_count": len(docs),
        "raw_conversation_count": len(conversations),
        "message_count": sum(int(doc.get("message_count") or 0) for doc in docs),
        "visible_message_count": sum(int(doc.get("visible_message_count") or 0) for doc in docs),
        "attachment_count": sum(int(doc.get("attachment_count") or 0) for doc in docs),
        "exported_asset_count": len(file_lookup),
        "role_counts": dict(role_counts),
        "content_type_counts": dict(content_type_counts),
        "model_counts": dict(model_counts),
        "month_counts": dict(sorted(month_counts.items())),
        "date_range": f"{dates[0]} 至 {dates[-1]}" if dates else "无明确时间",
        "errors": errors[:80],
    }
    return docs, stats


def attachment_rows_html(doc: dict[str, Any], export_name: str) -> str:
    attachments = doc.get("attachments") or []
    if not attachments:
        return '<p class="empty">这个会话没有导出的附件。</p>'
    rows = []
    for item in attachments:
        raw_path = item.get("raw_path") or ""
        href = ""
        if raw_path.startswith("chatgpt-vault/"):
            href = "../../" + raw_path.removeprefix("chatgpt-vault/")
        name = html_lib.escape(str(item.get("name") or item.get("id") or "未命名附件"))
        size = int(item.get("size") or 0)
        mime = html_lib.escape(str(item.get("mime_type") or item.get("extension") or "文件"))
        link = f'<a href="{html_lib.escape(href)}">{name}</a>' if href else name
        rows.append(f"<tr><td>{link}</td><td>{mime}</td><td>{size:,}</td></tr>")
    return "<table><thead><tr><th>文件</th><th>类型</th><th>大小 bytes</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>"


def write_chatgpt_item_pages(root: Path, docs: list[dict[str, Any]], export_name: str) -> None:
    item_dir = root / "chatgpt-vault" / "html" / "items"
    item_dir.mkdir(parents=True, exist_ok=True)
    for doc in docs:
        title = html_lib.escape(str(doc.get("title") or "ChatGPT 会话"))
        category = html_lib.escape(str(doc.get("category") or "未分类"))
        model = html_lib.escape(str(doc.get("model") or "auto"))
        created = html_lib.escape(str(doc.get("created_at_full") or doc.get("created_at") or ""))
        updated = html_lib.escape(str(doc.get("updated_at_full") or doc.get("updated_at") or ""))
        source_path = html_lib.escape(str(doc.get("source_path") or ""))
        body = html_lib.escape(str(doc.get("body") or doc.get("excerpt") or ""))
        raw_link = f"../../{html_lib.escape(export_name)}/chat.html"
        attachment_html = attachment_rows_html(doc, export_name)
        html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} - ChatGPT Vault</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; background: #f8fafd; }}
    header {{ padding: 18px 22px; border-bottom: 1px solid #dde3ea; background: #fff; }}
    main {{ max-width: 1060px; margin: 0 auto; padding: 22px; }}
    a {{ color: #1a73e8; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    h1 {{ margin: 0 0 10px; font-size: 24px; line-height: 1.3; }}
    h2 {{ margin: 24px 0 10px; font-size: 18px; }}
    .meta {{ display: flex; flex-wrap: wrap; gap: 8px; color: #5f6368; font-size: 13px; }}
    .badge {{ border: 1px solid #cbd5df; border-radius: 8px; padding: 3px 8px; background: #fff; }}
    nav {{ margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap; }}
    pre {{ white-space: pre-wrap; word-wrap: break-word; padding: 18px; background: #fff; border: 1px solid #dde3ea; border-radius: 8px; overflow: auto; }}
    table {{ width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dde3ea; }}
    th, td {{ padding: 9px 10px; border-bottom: 1px solid #edf1f5; text-align: left; vertical-align: top; }}
    th {{ background: #f1f4f9; font-size: 13px; color: #4b5563; }}
    .empty {{ padding: 14px; background: #fff; border: 1px dashed #dde3ea; color: #5f6368; }}
  </style>
</head>
<body>
  <header>
    <h1>{title}</h1>
    <div class="meta">
      <span class="badge">ChatGPT</span>
      <span class="badge">{category}</span>
      <span class="badge">{model}</span>
      <span class="badge">创建 {created}</span>
      <span class="badge">更新 {updated}</span>
      <span class="badge">{int(doc.get('message_count') or 0):,} 消息</span>
      <span class="badge">{int(doc.get('attachment_count') or 0):,} 附件</span>
    </div>
    <nav>
      <a href="../../../index.html">返回 online-vault</a>
      <a href="../index.html">ChatGPT 索引</a>
      <a href="{raw_link}">原始 chat.html</a>
    </nav>
  </header>
  <main>
    <p><strong>来源：</strong>{source_path}</p>
    <h2>会话主分支</h2>
    <pre>{body}</pre>
    <h2>附件</h2>
    {attachment_html}
  </main>
</body>
</html>
"""
        (item_dir / f"{doc['id']}.html").write_text(html, encoding="utf-8")


def write_chatgpt_outputs(root: Path, generated_at: str | None, docs: list[dict[str, Any]], stats: dict[str, Any]) -> None:
    export_dir = root / stats.get("export_dir", "") if stats.get("export_dir") else latest_export_dir(root)
    export_name = export_dir.name if export_dir else ""
    write_chatgpt_item_pages(root, docs, export_name)
    public_docs = [public_doc(doc) for doc in docs]
    index = {
        "generated_at": generated_at or now_iso(),
        "categories": CATEGORIES,
        "summary": summary_for_docs(public_docs),
        "stats": stats,
        "documents": public_docs,
    }
    chatgpt_dir = root / "chatgpt-vault"
    write_json(chatgpt_dir / "search-index.json", index)
    write_js(chatgpt_dir / "html" / "search-index.js", "CHATGPT_VAULT_INDEX", index)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    generated_at = now_iso()
    docs, stats = build_chatgpt_docs(root)
    write_chatgpt_outputs(root, generated_at, docs, stats)
    try:
        from render_channel_dashboards import render_chatgpt_dashboard

        render_chatgpt_dashboard(root)
    except Exception as exc:
        print(f"[warn] chatgpt dashboard rendering failed: {exc}")
    print(json.dumps({"documents": len(docs), "stats": stats}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
