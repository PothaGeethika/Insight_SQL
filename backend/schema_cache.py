"""In-memory schema cache keyed by connection_id with TTL."""

from __future__ import annotations

import threading
import time
from typing import Any, Optional

from logger_config import get_logger

log = get_logger("schema_cache")


class SchemaCache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = max(0, int(ttl_seconds))
        self._entries: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get(self, connection_id: str) -> Optional[dict[str, Any]]:
        if not connection_id or self.ttl_seconds <= 0:
            return None
        now = time.time()
        with self._lock:
            entry = self._entries.get(connection_id)
            if not entry:
                return None
            if now - entry["ts"] > self.ttl_seconds:
                del self._entries[connection_id]
                log.debug("[SCHEMA_CACHE] Expired connection_id=%s", connection_id)
                return None
            log.debug("[SCHEMA_CACHE] Hit connection_id=%s", connection_id)
            return {
                "structured": entry["structured"],
                "text": entry["text"],
            }

    def set(self, connection_id: str, structured: Any, text: str) -> None:
        if not connection_id or self.ttl_seconds <= 0:
            return
        with self._lock:
            self._entries[connection_id] = {
                "structured": structured,
                "text": text,
                "ts": time.time(),
            }
        log.debug("[SCHEMA_CACHE] Set connection_id=%s text_len=%d", connection_id, len(text or ""))

    def invalidate(self, connection_id: Optional[str] = None) -> None:
        with self._lock:
            if connection_id is None:
                self._entries.clear()
                log.info("[SCHEMA_CACHE] Cleared all entries")
            else:
                self._entries.pop(connection_id, None)
                log.info("[SCHEMA_CACHE] Invalidated connection_id=%s", connection_id)


def format_structured_schema(structured: Any) -> str:
    """Render a structured schema document as prompt-friendly text."""
    if structured is None:
        return ""
    if isinstance(structured, str):
        return structured
    if not isinstance(structured, dict):
        return str(structured)

    dialect = structured.get("dialect") or structured.get("type") or ""
    lines: list[str] = []
    if dialect:
        lines.append(f"Dialect: {dialect}")

    if structured.get("database"):
        lines.append(f"Database: {structured['database']}")

    tables = structured.get("tables") or []
    for table in tables:
        schema_name = table.get("schema")
        name = table.get("name", "unknown")
        title = f"{schema_name}.{name}" if schema_name and schema_name != "public" else name
        lines.append(f"\nTable: {title}")
        for col in table.get("columns") or []:
            col_name = col.get("name", "?")
            col_type = col.get("type", "unknown")
            flags = []
            if col.get("primary_key"):
                flags.append("PK")
            if col.get("nullable") is False:
                flags.append("NOT NULL")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            lines.append(f"  - {col_name} ({col_type}){flag_str}")
        for fk in table.get("foreign_keys") or []:
            lines.append(
                f"  - FK: {fk.get('column')} -> {fk.get('ref_schema', '')}."
                f"{fk.get('ref_table')}.{fk.get('ref_column')}".replace("..", ".")
            )

    collections = structured.get("collections") or []
    for coll in collections:
        lines.append(f"\nCollection: {coll.get('name', 'unknown')}")
        if coll.get("count") is not None:
            lines.append(f"  approx_count: {coll['count']}")
        for field in coll.get("fields") or []:
            types = field.get("types") or ([field.get("type")] if field.get("type") else [])
            type_str = "|".join(str(t) for t in types if t) or "unknown"
            lines.append(f"  - {field.get('name', '?')} ({type_str})")

    indices = structured.get("indices") or structured.get("indexes") or []
    for idx in indices:
        lines.append(f"\nIndex: {idx.get('name', 'unknown')}")
        for field in idx.get("fields") or []:
            lines.append(f"  - {field.get('name', '?')} ({field.get('type', 'unknown')})")

    nodes = structured.get("nodes") or []
    if nodes:
        lines.append("\nNodes:")
        for node in nodes:
            lines.append(f"  - Label: {node.get('label', 'unknown')}")
            for prop in node.get("properties") or []:
                if isinstance(prop, dict):
                    lines.append(f"    - {prop.get('name', '?')} ({prop.get('type', 'unknown')})")
                else:
                    lines.append(f"    - {prop}")

    rels = structured.get("relationships") or []
    if rels:
        lines.append("\nRelationships:")
        for rel in rels:
            lines.append(f"  - Type: {rel.get('type', 'unknown')}")
            for prop in rel.get("properties") or []:
                if isinstance(prop, dict):
                    lines.append(f"    - {prop.get('name', '?')} ({prop.get('type', 'unknown')})")
                else:
                    lines.append(f"    - {prop}")

    return "\n".join(lines).strip()
