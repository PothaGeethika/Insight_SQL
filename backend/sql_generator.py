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
    
    response = llm.invoke(prompt)
    content = response.content
    if isinstance(content, list):
        # Join list if it's a list of content blocks
        content = "".join([c if isinstance(c, str) else str(c.get("text", "")) for c in content])
        # print(content,"content-------")
        # input(">>>>>>>>>>>>>>")    
    return content.strip().replace("```sql", "").replace("```", "").strip()
