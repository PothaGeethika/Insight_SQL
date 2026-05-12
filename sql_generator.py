def generate_sql(question, schema, llm):
    prompt = f"""
    You are a PostgreSQL expert.
    
    Database schema:
    {schema}
    
    User question: {question}
    
    Write ONLY the SQL query, nothing else.
    No explanations, no markdown, just raw SQL.
    """
    
    response = llm.invoke(prompt)
    content = response.content
    if isinstance(content, list):
        # Join list if it's a list of content blocks
        content = "".join([c if isinstance(c, str) else str(c.get("text", "")) for c in content])
        # print(content,"content-------")
        # input(">>>>>>>>>>>>>>")    
    return content.strip().replace("```sql", "").replace("```", "").strip()
