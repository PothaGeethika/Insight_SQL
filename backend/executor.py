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
        
        # Check if it's a SELECT query that returns rows
        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            # Convert to list of dicts
            result = []
            for row in rows:
                result.append(dict(zip(columns, row)))
            
            elapsed = time.perf_counter() - t0
            log.info("[EXECUTOR] Query execution returned %d row(s) in %.3fs.", len(result), elapsed)
            return {"success": True, "data": result}
        else:
            conn.commit()
            elapsed = time.perf_counter() - t0
            log.info("[EXECUTOR] Query executed successfully with no results (committed) in %.3fs.", elapsed)
            return {"success": True, "data": "Query executed successfully (no results to display)."}
    
    except Exception as e:
        log.error("[EXECUTOR] Execution error: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}
