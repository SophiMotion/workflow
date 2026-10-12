#!/usr/bin/env python3
"""v2-search.py — online-vault 知识库搜索服务端（供 v2.html / Cowork artifact 调用）

Usage:
  python3 v2-search.py --q "关键词" --theme "AI工具" --limit 20
  python3 v2-search.py --get-docs id1 id2 id3
"""
from __future__ import annotations
import json, sys, os, re, argparse
from pathlib import Path

INDEX_PATH = Path(__file__).resolve().parent / "v2-index-light.json"
INDEX_DATA: dict | None = None

def load_index():
    global INDEX_DATA
    if INDEX_DATA is None:
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            INDEX_DATA = json.load(f)
    return INDEX_DATA

def search(query: str, theme: str = "", limit: int = 50) -> dict:
    data = load_index()
    docs = data["documents"]

    if theme:
        docs = [d for d in docs if d.get("category") == theme]

    if query:
        q = query.lower()
        terms = q.split()
        scored = []
        for d in docs:
            title = (d.get("title") or "").lower()
            excerpt = (d.get("excerpt") or "").lower()
            account = (d.get("account") or "").lower()
            score = 0
            all_match = True
            for t in terms:
                if t in title: score += 100
                elif t in account: score += 50
                elif t in excerpt: score += 30
                else:
                    all_match = False
                    break
            if all_match:
                if d.get("date", "").startswith("2026"): score += 8
                elif d.get("date", "").startswith("2025"): score += 3
                if d.get("channel") == "wechat": score += 5
                scored.append((score, d))
        scored.sort(key=lambda x: -x[0])
        docs = [d for _, d in scored]

    total = len(docs)
    docs = docs[:limit]

    # Build distribution
    dist = {}
    for d in docs:
        ch = d.get("channel", "other")
        dist[ch] = dist.get(ch, 0) + 1

    return {
        "query": query,
        "theme": theme,
        "total": total,
        "returned": len(docs),
        "distribution": dist,
        "results": docs,
    }

def get_documents(doc_ids: list[str]) -> list[dict]:
    """Get full document details by IDs, searching both light index and original JS."""
    data = load_index()
    doc_map = {d["id"]: d for d in data["documents"]}

    results = []
    for doc_id in doc_ids:
        if doc_id in doc_map:
            results.append(doc_map[doc_id])
    return results

def get_document_count_by_theme() -> dict:
    data = load_index()
    counts = {}
    for d in data["documents"]:
        cat = d.get("category", "未知")
        counts[cat] = counts.get(cat, 0) + 1
    return counts

def main():
    parser = argparse.ArgumentParser(description="v2 knowledge base search")
    parser.add_argument("--q", type=str, default="", help="Search query")
    parser.add_argument("--theme", type=str, default="", help="Theme/category filter")
    parser.add_argument("--limit", type=int, default=50, help="Max results")
    parser.add_argument("--get-docs", type=str, nargs="*", help="Get specific documents by ID")
    parser.add_argument("--stats", action="store_true", help="Get summary statistics")

    args = parser.parse_args()

    if args.get_docs:
        result = get_documents(args.get_docs)
    elif args.stats:
        data = load_index()
        result = {
            "total": len(data["documents"]),
            "categories": data.get("categories", []),
            "channels": data.get("channels", {}),
            "summary": data.get("summary", {}),
            "theme_counts": get_document_count_by_theme(),
        }
    else:
        result = search(args.q, args.theme, args.limit)

    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
