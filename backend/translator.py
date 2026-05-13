def translate_to_english(question, data, llm):
    prompt = f"""
    The user asked: "{question}"
    
    The database returned this data: {data}
    
    Explain this result in one or two simple, 
    friendly sentences in plain English.
    No technical terms. No SQL. Just the answer.
    """
    
    response = llm.invoke(prompt)
    content = response.content
    if isinstance(content, list):
        content = "".join([c if isinstance(c, str) else str(c.get("text", "")) for c in content])
        
    return content.strip()
