import re
import time
from logger_config import get_logger

log = get_logger("executor")

_FORBIDDEN_PATTERN = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|CALL|EXEC|EXECUTE|GRANT|REVOKE|LOCK|UNLOCK|RENAME|SET\s+GLOBAL|LOAD\s+DATA)\b",
    re.IGNORECASE,
)

def _assert_read_only(sql: str) -> None:
    stripped = re.sub(r"--[^\n]*", "", sql)
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL).strip()
    if _FORBIDDEN_PATTERN.match(stripped):
        first_word = stripped.split()[0].upper() if stripped.split() else ""
        log.warning("[EXECUTOR] Blocked forbidden SQL statement: %s", first_word)
        raise ValueError(
            f"Unsafe SQL statement '{first_word}' is not allowed. Only read-only SELECT queries are permitted."
        )

def execute_sql(conn, sql):
    _assert_read_only(sql)
    log.info("[EXECUTOR] Executing raw SQL query.")
    log.debug("[EXECUTOR] SQL Query:\n%s", sql)
    try:
        t0 = time.perf_counter()
        cursor = conn.cursor()
        cursor.execute(sql)

        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            result = [dict(zip(columns, row)) for row in rows]
            elapsed = time.perf_counter() - t0
            log.info("[EXECUTOR] Query returned %d row(s) in %.3fs.", len(result), elapsed)
            return {"success": True, "data": result}
        else:
            # No-op: read-only check above prevents writes reaching here,
            # but handle gracefully just in case (e.g. EXPLAIN).
            elapsed = time.perf_counter() - t0
            log.info("[EXECUTOR] Query executed with no result set in %.3fs.", elapsed)
            return {"success": True, "data": []}

    except Exception as e:
        log.error("[EXECUTOR] Execution error: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}
