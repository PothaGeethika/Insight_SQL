import time
from logger_config import get_logger

log = get_logger("executor")

def execute_sql(conn, sql):
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
            conn.commit()
            elapsed = time.perf_counter() - t0
            log.info("[EXECUTOR] Mutating query executed successfully in %.3fs.", elapsed)
            return {"success": True, "data": []}

    except Exception as e:
        log.error("[EXECUTOR] Execution error: %s", e, exc_info=True)
        # Attempt to rollback on error just in case
        try:
            conn.rollback()
        except:
            pass
        return {"success": False, "error": str(e)}
