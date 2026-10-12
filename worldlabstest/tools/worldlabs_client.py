#!/usr/bin/env python3
"""World API starter. Dry-run by default; never put credentials in browser files.
API contract checked against https://docs.worldlabs.ai/api on 2026-10-01.
"""
import argparse
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

BASE = "https://api.worldlabs.ai/marble/v1"
MODELS = {"marble-1.0-draft", "marble-1.0", "marble-1.1", "marble-1.1-plus"}


def valid_id(value):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,150}", value):
        raise ValueError("Invalid world/operation ID")
    return quote(value, safe="")


def validate_request(data):
    if not isinstance(data, dict) or data.get("model") not in MODELS:
        raise ValueError("Use an explicit supported model; see World Labs model docs")
    prompt = data.get("world_prompt", {})
    if not isinstance(prompt, dict) or prompt.get("type") not in {"text", "image"}:
        raise ValueError("This starter validates text or image input only")
    if not isinstance(data.get("display_name"), str) or not data["display_name"].strip():
        raise ValueError("display_name is required")
    if prompt["type"] == "text" and not str(prompt.get("text_prompt", "")).strip():
        raise ValueError("text_prompt is required")
    if prompt["type"] == "image":
        image = prompt.get("image_prompt", {})
        if not isinstance(image, dict):
            raise ValueError("image_prompt must be an object")
        if image.get("source") == "uri":
            u = urlparse(image.get("uri", ""))
            if u.scheme != "https" or not u.netloc or u.username or u.password:
                raise ValueError("Image input must be an accessible HTTPS URL")
        elif image.get("source") == "media_asset":
            valid_id(image.get("media_asset_id", ""))
        else:
            raise ValueError("Image source must be uri or media_asset")
    return data


def request(path, method="GET", payload=None):
    key = os.environ.get("WORLDLABS_API_KEY")
    if not key:
        raise ValueError("Set WORLDLABS_API_KEY locally; never paste it into HTML or chat")
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(BASE + path, data=body, method=method,
                  headers={"WLT-Api-Key": key, "Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=45) as response:
            return json.load(response)
    except HTTPError as e:
        # Do not print raw response bodies, headers or credentials.
        hints = {401: "Check API key", 402: "Check API credits", 429: "Rate limit; retry GET later"}
        raise RuntimeError(f"World API HTTP {e.code}: {hints.get(e.code, 'check the platform operation history')}") from None
    except (URLError, TimeoutError) as e:
        hint = "Do not resubmit generation blindly; inspect platform operations first" if method == "POST" else "Retry the same read-only query later"
        raise RuntimeError(f"Network request did not complete. {hint}") from None


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def manifest(world):
    world_id = valid_id(world.get("world_id") or world.get("id") or "")
    assets = world.get("assets") or {}
    splats = assets.get("splats") or {}
    urls = splats.get("spz_urls") or {}
    semantics = splats.get("semantics_metadata") or {}
    scale, offset = semantics.get("metric_scale_factor", 1), semantics.get("ground_plane_offset", 0)
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0:
        raise ValueError("World has invalid metric_scale_factor")
    if not isinstance(offset, (int, float)) or not math.isfinite(offset):
        raise ValueError("World has invalid ground_plane_offset")
    return {"schema_version": "1.0", "projects": [{
        "id": "world-" + world_id,
        "title": str(world.get("display_name") or "World Labs world")[:70],
        "source": "sophistudio", "source_url": "", "stage": "planned", "verification": "unverified",
        "description": "World Labs 生成环境；尚未进行道路、车辆、物理或实测验证。",
        "world": {"marble_url": world.get("world_marble_url") or f"https://marble.worldlabs.ai/world/{world_id}",
                  "spz_url": urls.get("100k") or urls.get("500k") or urls.get("full_res") or "",
                  "metric_scale_factor": scale, "ground_plane_offset": offset, "axis_flip": True}
    }]}


def save_world(world, output):
    write_json(output / "world.json", world)
    write_json(output / "project-import.json", manifest(world))
    print(f"Saved world metadata and import manifest to {output}")
    print("Assets are not downloaded. Archive them separately with their source and versions.")


def poll(operation_id, output, wait_seconds):
    operation_id = valid_id(operation_id)
    deadline = time.monotonic() + wait_seconds
    while True:
        op = request("/operations/" + operation_id)
        write_json(output / "operation.json", op)
        if op.get("error"):
            raise RuntimeError("Generation failed. Inspect saved operation.json; no automatic resubmission was made")
        if op.get("done"):
            snapshot = op.get("response") or {}
            snapshot = snapshot.get("world", snapshot)
            world_id = snapshot.get("world_id") or snapshot.get("id") or (op.get("metadata") or {}).get("world_id")
            if not world_id:
                raise RuntimeError("Completed operation has no world ID; inspect operation.json")
            response = request("/worlds/" + valid_id(world_id))
            save_world(response.get("world", response), output)
            return
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            print(f"Still pending. Resume with --operation {operation_id} --out {output}")
            return
        time.sleep(min(5, remaining))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--request", type=Path, help="JSON request; no API call without --submit")
    source.add_argument("--operation", help="Resume/read an existing operation")
    source.add_argument("--world", help="Fetch an existing world")
    source.add_argument("--credits", action="store_true", help="Read API credit balance")
    parser.add_argument("--submit", action="store_true", help="Explicitly submit one billable generation")
    parser.add_argument("--wait-seconds", type=float, default=0, help="Optional polling deadline; default single GET")
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "runs" / time.strftime("%Y%m%d-%H%M%S"))
    args = parser.parse_args(argv)
    if args.submit and not args.request:
        parser.error("--submit only applies with --request")
    if not 0 <= args.wait_seconds <= 3600:
        parser.error("--wait-seconds must be between 0 and 3600")
    if args.request:
        payload = validate_request(json.loads(args.request.read_text()))
        if not args.submit:
            print("DRY RUN — no network call, no credits consumed")
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0
        if not os.environ.get("WORLDLABS_API_KEY"):
            raise ValueError("Set WORLDLABS_API_KEY before --submit")
        # Refuse to overwrite a run and accidentally submit duplicate paid work.
        args.out.mkdir(parents=True, exist_ok=False)
        write_json(args.out / "request.json", payload)
        op = request("/worlds:generate", "POST", payload)
        write_json(args.out / "operation.json", op)
        operation_id = op.get("operation_id")
        if not operation_id:
            raise RuntimeError("Submission returned no operation_id; inspect the saved response before retrying")
        print("Submitted once. Operation ID:", operation_id)
        poll(operation_id, args.out, args.wait_seconds)
    elif args.operation:
        poll(args.operation, args.out, args.wait_seconds)
    elif args.world:
        response = request("/worlds/" + valid_id(args.world))
        save_world(response.get("world", response), args.out)
    else:
        print(json.dumps(request("/credits"), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print("Error:", error, file=sys.stderr)
        sys.exit(1)
