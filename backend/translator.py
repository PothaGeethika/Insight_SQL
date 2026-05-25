import time
from logger_config import get_logger

log = get_logger("translator")

def translate_to_english(question, data, llm):
    prompt = f"""
    The user asked: "{question}"
    
    The database returned this data: {data}
    
    Explain this result in one or two simple, 
    friendly sentences in plain English.
    No technical terms. No SQL. Just the answer.
    """
    
    log.info("[TRANSLATOR] Translating SQL results to plain English for question: '%s'", question)
    
    t0 = time.perf_counter()
    response = llm.invoke(prompt)
    elapsed = time.perf_counter() - t0
    
    content = response.content
    if isinstance(content, list):
        content = "".join([c if isinstance(c, str) else str(c.get("text", "")) for c in content])
        
    translation = content.strip()
    log.info("[TRANSLATOR] Translation completed in %.2fs", elapsed)
    log.debug("[TRANSLATOR] Result:\n%s", translation)
    
    return translation
