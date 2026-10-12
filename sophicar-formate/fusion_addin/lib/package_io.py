"""Safe SophiCAD ZIP IO. / 安全的 SophiCAD 数据包读写。"""

from __future__ import annotations

import hashlib
import io
import json
import os
import tempfile
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Dict, Mapping, Optional, Union

from .domain import DocumentSnapshot


MAX_FILES = 4096
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 1024 * 1024 * 1024
ZIP_TIME = (1980, 1, 1, 0, 0, 0)


class PackageError(Exception):
    def __init__(self, code: str, message: str, path: Optional[str] = None):
        super().__init__(message)
        self.code = code
        self.path = path


@dataclass(frozen=True)
class UpdatePackage:
    manifest: Mapping[str, Any]
    model: Mapping[str, Any]
    changes: Mapping[str, Any]
    files: Mapping[str, bytes]


@dataclass(frozen=True)
class PackageWriteResult:
    output_path: Path
    file_count: int
    byte_count: int


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")


def _pretty_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _normalized_model(snapshot: DocumentSnapshot) -> Dict[str, Any]:
    model = snapshot.to_model_dict()
    model["parameters"]["user"] = sorted(
        model["parameters"]["user"], key=lambda item: item["name"]
    )
    model["parameters"]["model"] = sorted(
        model["parameters"]["model"], key=lambda item: item["name"]
    )
    for key in ("components", "occurrences", "joints"):
        model[key] = sorted(model[key], key=lambda item: item["id"])
    model["physicalProperties"] = sorted(
        model["physicalProperties"], key=lambda item: item["entityId"]
    )
    model["bom"] = sorted(model["bom"], key=lambda item: item["componentId"])
    return model


def compute_source_fingerprint(snapshot: DocumentSnapshot) -> str:
    return hashlib.sha256(canonical_json_bytes(_normalized_model(snapshot))).hexdigest()


def _validate_path(path: str) -> bool:
    if not path or "\\" in path or path.startswith("/"):
        raise PackageError("unsafe_archive_path", "不安全的数据包路径：{}".format(path), path)
    if len(path) >= 2 and path[1] == ":":
        raise PackageError("unsafe_archive_path", "不安全的数据包路径：{}".format(path), path)
    parts = PurePosixPath(path).parts
    if any(part in ("", ".", "..") for part in parts):
        raise PackageError("unsafe_archive_path", "不安全的数据包路径：{}".format(path), path)
    return path.endswith("/")


def _purpose(path: str) -> str:
    if path in ("model.json", "changes.json"):
        return "authority"
    if path.startswith("meshes/visual/"):
        return "visual-mesh"
    if path.startswith("meshes/collision/"):
        return "collision-mesh"
    if path.startswith("robot/"):
        return "robot"
    if path.startswith("reports/"):
        return "report"
    return "other"


def _archive_bytes(files: Mapping[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for path in sorted(files):
            info = zipfile.ZipInfo(path, ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, files[path], compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
    return output.getvalue()


def write_package(
    output_path: Union[str, Path],
    *,
    manifest: Mapping[str, Any],
    model: Mapping[str, Any],
    files: Mapping[str, bytes],
    changes: Optional[Mapping[str, Any]] = None,
) -> PackageWriteResult:
    output = Path(output_path)
    if output.exists():
        raise PackageError("output_already_exists", "输出文件已存在。", str(output))
    output.parent.mkdir(parents=True, exist_ok=True)

    payloads: Dict[str, bytes] = {"model.json": _pretty_json_bytes(model)}
    if changes is not None:
        payloads["changes.json"] = _pretty_json_bytes(changes)
    for path, content in files.items():
        if _validate_path(path) or path in ("manifest.json", "model.json", "changes.json"):
            raise PackageError("unsafe_archive_path", "不能写入保留或目录路径。", path)
        if path in payloads:
            raise PackageError("duplicate_package_path", "重复的数据包路径。", path)
        payloads[path] = bytes(content)

    entries = [
        {
            "path": path,
            "purpose": _purpose(path),
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        for path, content in sorted(payloads.items())
    ]
    final_manifest = dict(manifest)
    final_manifest["files"] = entries
    archive_files = {"manifest.json": _pretty_json_bytes(final_manifest), **payloads}
    archive = _archive_bytes(archive_files)

    temporary = output.with_name("{}.tmp-{}".format(output.name, uuid.uuid4().hex))
    try:
        with open(temporary, "xb") as handle:
            handle.write(archive)
            handle.flush()
            os.fsync(handle.fileno())
        if output.exists():
            raise PackageError("output_already_exists", "输出文件已存在。", str(output))
        os.replace(str(temporary), str(output))
    finally:
        if temporary.exists():
            temporary.unlink()
    return PackageWriteResult(output, len(archive_files), len(archive))


def _source_bytes(source: Union[str, Path, bytes, bytearray]) -> bytes:
    if isinstance(source, (bytes, bytearray)):
        return bytes(source)
    return Path(source).read_bytes()


def read_update_package(source: Union[str, Path, bytes, bytearray]) -> UpdatePackage:
    files: Dict[str, bytes] = {}
    total = 0
    try:
        with zipfile.ZipFile(io.BytesIO(_source_bytes(source))) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_FILES:
                raise PackageError("archive_file_limit_exceeded", "数据包文件数超过限制。")
            for info in infos:
                directory = _validate_path(info.filename)
                if directory:
                    continue
                if info.file_size > MAX_FILE_BYTES:
                    raise PackageError("archive_file_size_exceeded", "单文件超过限制。", info.filename)
                total += info.file_size
                if total > MAX_TOTAL_BYTES:
                    raise PackageError("archive_total_size_exceeded", "数据包总大小超过限制。")
                files[info.filename] = archive.read(info)
    except zipfile.BadZipFile as error:
        raise PackageError("invalid_zip", "数据包不是有效 ZIP。") from error

    for required in ("manifest.json", "model.json", "changes.json"):
        if required not in files:
            raise PackageError("required_file_missing", "缺少 {}。".format(required), required)
    try:
        manifest = json.loads(files["manifest.json"].decode("utf-8"))
        model = json.loads(files["model.json"].decode("utf-8"))
        changes = json.loads(files["changes.json"].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PackageError("invalid_json", "权威 JSON 文件无效。") from error

    if not str(manifest.get("schemaVersion", "")).startswith("1."):
        raise PackageError("unsupported_schema_major", "仅支持 SophiCAD Schema 1.x。")
    declared = set()
    for entry in manifest.get("files", []):
        path = entry.get("path")
        if not isinstance(path, str) or path in declared:
            raise PackageError("duplicate_manifest_path", "manifest 路径无效或重复。")
        declared.add(path)
        content = files.get(path)
        if content is None:
            raise PackageError("required_file_missing", "manifest 声明文件缺失。", path)
        if len(content) != entry.get("bytes"):
            raise PackageError("file_size_mismatch", "文件大小不匹配。", path)
        if hashlib.sha256(content).hexdigest() != entry.get("sha256"):
            raise PackageError("file_hash_mismatch", "文件哈希不匹配。", path)
    extras = set(files) - {"manifest.json"} - declared
    if extras:
        path = sorted(extras)[0]
        raise PackageError("undeclared_file", "数据包存在未声明文件。", path)
    return UpdatePackage(manifest, model, changes, files)
