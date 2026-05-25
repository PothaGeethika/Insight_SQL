import time
from logger_config import get_logger

log = get_logger("sql_gen")

def generate_sql(question, schema, llm):
    prompt = f"""
    You are a PostgreSQL expert.
    
    Database schema:
    {schema}
    
    User question: {question}
    
    Write ONLY a SINGLE SQL query, nothing else.
    If you need to return multiple facts (like counting tables and columns), combine them into ONE single result row using subqueries (e.g., SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') as tables, (SELECT count(*) FROM information_schema.columns WHERE table_schema='public') as columns).
    No explanations, no markdown, just raw SQL.
    
    IMPORTANT: When counting total rows in the database, do NOT use pg_class estimates (like reltuples) as they can be 0 even if data exists. 
    Instead, use accurate methods or query the tables directly if possible.
    """
    
    log.info("[SQL_GEN] Generating SQL for question: '%s'", question)
    log.debug("[SQL_GEN] Provided schema length: %d chars", len(schema))
    
    t0 = time.perf_counter()
    response = llm.invoke(prompt)
    elapsed = time.perf_counter() - t0
    
    content = response.content
    if isinstance(content, list):
        # Join list if it's a list of content blocks
        content = "".join([c if isinstance(c, str) else str(c.get("text", "")) for c in content])
        
    final_sql = content.strip().replace("```sql", "").replace("```", "").strip()
    log.info("[SQL_GEN] SQL generation completed in %.2fs", elapsed)
    log.debug("[SQL_GEN] Generated SQL:\n%s", final_sql)
    
    return final_sql
