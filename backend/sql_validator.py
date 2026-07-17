"""Read-only query validation for NL→SQL / Cypher execution paths."""

from __future__ import annotations

import re
from typing import Optional

_SQL_ALLOWED_PREFIXES = frozenset({
    "SELECT", "WITH", "EXPLAIN", "SHOW", "DESCRIBE", "DESC", "PRAGMA",
})

_SQL_MUTATING = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|MERGE|"
    r"GRANT|REVOKE|CALL|EXEC|EXECUTE|COPY|LOAD\s+DATA|ATTACH|DETACH|"
    r"VACUUM|REINDEX|CLUSTER|REFRESH\s+MATERIALIZED|UPSERT"
    r")\b",
    re.IGNORECASE,
)

_SELECT_INTO = re.compile(r"\bSELECT\b.+\bINTO\b", re.IGNORECASE | re.DOTALL)

_CYPHER_FORBIDDEN = re.compile(
    r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|LOAD\s+CSV)\b",
    re.IGNORECASE,
)

_COMMENT_BLOCK = re.compile(r"/\*.*?\*/", re.DOTALL)
_COMMENT_LINE = re.compile(r"--.*?$", re.MULTILINE)
_COMMENT_HASH = re.compile(r"#.*?$", re.MULTILINE)


def _strip_sql_comments(sql: str) -> str:
    sql = _COMMENT_BLOCK.sub(" ", sql)
    sql = _COMMENT_LINE.sub(" ", sql)
    sql = _COMMENT_HASH.sub(" ", sql)
    return sql.strip()


def _split_statements(sql: str) -> list[str]:
    """Split on semicolons not inside single/double quotes."""
    parts: list[str] = []
    buf: list[str] = []
    in_single = False
    in_double = False
    for ch in sql:
        if ch == "'" and not in_double:
            in_single = not in_single
            buf.append(ch)
        elif ch == '"' and not in_single:
            in_double = not in_double
            buf.append(ch)
        elif ch == ";" and not in_single and not in_double:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf))
    return parts


def validate_readonly_sql(sql: str) -> None:
    """Raise ValueError if the SQL is not a single read-only statement."""
    if not sql or not str(sql).strip():
        raise ValueError("Read-only violation: empty query.")

    cleaned = _strip_sql_comments(str(sql))
    statements = [s.strip() for s in _split_statements(cleaned) if s.strip()]
    if not statements:
        raise ValueError("Read-only violation: empty query after stripping comments.")
    if len(statements) > 1:
        raise ValueError("Read-only violation: multiple SQL statements are not allowed.")

    statement = statements[0]
    tokens = statement.split()
    if not tokens:
        raise ValueError("Read-only violation: empty query.")

    first = tokens[0].upper()
    if first not in _SQL_ALLOWED_PREFIXES:
        raise ValueError(
            f"Read-only violation: only SELECT/WITH/EXPLAIN/SHOW/DESCRIBE queries are allowed "
            f"(got '{first}')."
        )

    # For EXPLAIN [ANALYZE] <stmt>, validate the inner statement separately when present
    body = statement
    if first == "EXPLAIN":
        rest = statement[len(tokens[0]):].lstrip()
        if rest.upper().startswith("ANALYZE"):
            rest = rest[len("ANALYZE"):].lstrip()
        if rest.upper().startswith("QUERY PLAN"):
            rest = rest[len("QUERY PLAN"):].lstrip()
        # FORMAT JSON / USING JSON wrappers – strip common prefixes lightly
        if rest.upper().startswith("(FORMAT"):
            close = rest.find(")")
            if close != -1:
                rest = rest[close + 1:].lstrip()
        if rest.upper().startswith("USING"):
            parts = rest.split(None, 2)
            rest = parts[2] if len(parts) >= 3 else ""
        if rest:
            body = rest
            body_first = body.split(None, 1)[0].upper() if body.strip() else ""
            if body_first and body_first not in ("SELECT", "WITH", "SHOW", "DESCRIBE", "DESC", "VALUES"):
                raise ValueError(
                    f"Read-only violation: EXPLAIN body must be a read query (got '{body_first}')."
                )

    if _SQL_MUTATING.search(body):
        raise ValueError(
            "Read-only violation: mutating or DDL statements are not allowed on the NL→SQL path."
        )
    if _SELECT_INTO.search(body):
        raise ValueError("Read-only violation: SELECT INTO is not allowed.")


def validate_readonly_cypher(cypher: str) -> None:
    """Raise ValueError if Cypher appears to mutate the graph."""
    if not cypher or not str(cypher).strip():
        raise ValueError("Read-only violation: empty Cypher query.")
    cleaned = _strip_sql_comments(str(cypher))
    if _CYPHER_FORBIDDEN.search(cleaned):
        raise ValueError(
            "Read-only violation: only read Cypher (MATCH/RETURN/WITH/OPTIONAL MATCH) is allowed."
        )
    first = cleaned.lstrip().split(None, 1)[0].upper() if cleaned.strip() else ""
    allowed = {"MATCH", "OPTIONAL", "WITH", "CALL", "EXPLAIN", "PROFILE", "RETURN", "UNWIND"}
    if first not in allowed:
        raise ValueError(
            f"Read-only violation: Cypher must start with MATCH/RETURN/WITH/CALL (got '{first}')."
        )


def validate_structural_sql(sql: str) -> None:
    """Basic safety checks for mutating/DDL queries (approval path)."""
    if not sql or not str(sql).strip():
        raise ValueError("Invalid query: empty query.")
    cleaned = _strip_sql_comments(str(sql))
    statements = [s.strip() for s in _split_statements(cleaned) if s.strip()]
    if not statements:
        raise ValueError("Invalid query: empty query after stripping comments.")
    if len(statements) > 1:
        raise ValueError("Invalid query: multiple SQL statements are not allowed.")


def validate_query_for_dialect(
    query: str,
    db_type: Optional[str],
    *,
    allow_mutating: bool = False,
) -> None:
    """Dispatch validation by dialect.

    When allow_mutating=True (approval/chat write path), only structural checks run
    for SQL/Cypher; READ-only enforcement is handled by the policy engine instead.
    """
    dtype = (db_type or "").lower()
    if dtype in ("mongodb", "elasticsearch"):
        return
    if allow_mutating:
        if dtype == "neo4j":
            if not query or not str(query).strip():
                raise ValueError("Invalid query: empty Cypher query.")
            return
        validate_structural_sql(query)
        return
    if dtype == "neo4j":
        validate_readonly_cypher(query)
        return
    validate_readonly_sql(query)
