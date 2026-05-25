import os
import time
# pyrefly: ignore [missing-import]
from langchain_google_genai import ChatGoogleGenerativeAI
# pyrefly: ignore [missing-import]
from langchain_groq import ChatGroq
# pyrefly: ignore [missing-import]
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from logger_config import get_logger
import json

load_dotenv()
log = get_logger("agent")

class SQLAgent:
    def __init__(self):
        self.sql_prompt = ChatPromptTemplate.from_template("""
        You are an expert SQL developer. Given the database schema below, convert the user's natural language question into a valid PostgreSQL query.
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Only return the SQL query. Do not include any explanations or markdown blocks like ```sql.
        2. Ensure the query is compatible with PostgreSQL.
        3. Use table aliases for clarity if joining multiple tables.
        
        SQL Query:
        """)

        self.mysql_prompt = ChatPromptTemplate.from_template("""
        You are an expert MySQL developer. Given the database schema below, convert the user's natural language question into a valid MySQL query.
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Only return the SQL query. Do not include any explanations or markdown blocks like ```sql.
        2. Ensure the query is compatible with MySQL.
        3. Use table aliases for clarity if joining multiple tables.
        
        MySQL Query:
        """)

        self.snowflake_prompt = ChatPromptTemplate.from_template("""
        You are an expert Snowflake SQL developer. Given the database schema below, convert the user's natural language question into a valid Snowflake SQL query.
        
        Database Type: snowflake
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Only return the SQL query. Do not include any explanations or markdown blocks like ```sql.
        2. Ensure the query uses valid Snowflake SQL syntax (e.g., ILIKE instead of ILIKE, LIMIT is supported, use QUALIFY for window function filtering).
        3. Use fully qualified table names if needed (DATABASE.SCHEMA.TABLE).
        4. Use table aliases for clarity if joining multiple tables.
        
        Snowflake SQL Query:
        """)

        self.mql_prompt = ChatPromptTemplate.from_template("""
        You are an expert MongoDB developer. Given the database schema (collections and sample fields) below, convert the user's natural language question into a valid MongoDB Query (MQL) in JSON format.
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Return ONLY a JSON object representing the query.
        2. The JSON must follow this structure:
           {{
               "collection": "name_of_collection",
               "action": "find" or "aggregate" or "count",
               "query": {{ ... }}, (for find or count)
               "projection": {{ ... }}, (optional, for find)
               "pipeline": [ ... ], (for aggregate)
               "limit": 100
           }}
        3. Do not include any explanations or markdown blocks.
        4. Ensure the query is optimized for performance.
        
        MQL JSON:
        """)

        self.elasticsearch_prompt = ChatPromptTemplate.from_template("""
        You are an expert Elasticsearch developer. Given the database schema (indices and their properties/fields) below, convert the user's natural language question into a valid Elasticsearch Query DSL in JSON format.
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Return ONLY a JSON object representing the search query body or index search wrapper.
        2. The JSON must follow this structure:
           {{
               "index": "name_of_index",
               "body": {{
                   "query": {{ ... }},
                   "_source": [ "field1", "field2" ], (optional projection)
                   "size": 100
               }}
           }}
        3. Do not include any explanations or markdown blocks.
        4. For nested/object fields, always query the fully qualified dot-notation field name (e.g., use 'destination.city' or 'customer.name' instead of just 'destination' or 'customer').
        5. Use "match" query (instead of "term" query) for text fields (like 'destination.city', names, descriptions) since "term" query does not analyze the search term and will fail to match due to casing (e.g., matching "Dubai" vs "dubai"). Use "term" or "terms" queries only for exact keywords, status fields, or ID fields.
        
        Elasticsearch DSL JSON:
        """)

        self.neo4j_prompt = ChatPromptTemplate.from_template("""
        You are an expert Neo4j developer. Given the database schema (nodes and relationships) below, convert the user's natural language question into a valid Cypher query.
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Only return the Cypher query. Do not include any explanations or markdown blocks like ```cypher.
        2. Ensure the query is optimized.
        3. Do not limit the results unless explicitly asked.
        
        Cypher Query:
        """)
        self.parser = StrOutputParser()
        
        self.synthesize_prompt = ChatPromptTemplate.from_template("""
        You are a helpful and expert data assistant. 
        Given the user's original question and the structured query results returned from the database, synthesize a clear, friendly, and complete natural language response.
        
        User's Question: {question}
        
        Query Results (Headers): {headers}
        Query Results (Rows): {rows}
        
        Instructions:
        1. Base your answer directly on the provided Query Results. If the results are empty, state that no matching records were found.
        2. Format your response clearly. Always output each matching record using clear, clean bullet points (not a raw dump of all JSON fields, and not a massive paragraph).
           Example format:
           Found X shipment(s) matching your criteria:
           
           - **Shipment ID:** SHIP-10001
             - **Status:** In Transit
             - **Origin:** Mumbai
             - **Destination:** Dubai
             - **Customer:** Acme Manufacturing Ltd
             
        3. Do NOT restrict or truncate the number of records returned to a small lines size like 10 or 20 lines. List ALL matching records returned from the query completely.
        4. Focus on key, high-level attributes (e.g., ID, Status, Origin, Destination, Customer name/details) rather than nesting every single subfield (such as item arrays or coordinates) unless specifically asked.
        5. Do not mention technical implementation details like SQL, MQL, or Elasticsearch syntax.
        
        Assistant Response:
        """)

    def get_llm(self, provider, model_name=None):
        log.debug("[LLM] Selecting provider='%s' model='%s'", provider, model_name)
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                log.error("[LLM] GEMINI_API_KEY is not set in environment!")
            log.info("[LLM] Using Google Gemini – model=%s", model_name or "gemini-2.0-flash")
            return ChatGoogleGenerativeAI(
                model=model_name or "gemini-2.0-flash",
                google_api_key=api_key,
                temperature=0
            )
        elif provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                log.error("[LLM] GROQ_API_KEY is not set in environment!")
            log.info("[LLM] Using Groq – model=%s", model_name or "llama-3.1-70b-versatile")
            return ChatGroq(
                model=model_name or "llama-3.1-70b-versatile",
                groq_api_key=api_key,
                temperature=0
            )
        elif provider == "deepseek":
            api_key = os.getenv("DEEPSEEK_API_KEY")
            if not api_key:
                log.error("[LLM] DEEPSEEK_API_KEY is not set in environment!")
            log.info("[LLM] Using DeepSeek – model=%s", model_name or "deepseek-chat")
            return ChatOpenAI(
                model=model_name or "deepseek-chat",
                api_key=api_key,
                base_url="https://api.deepseek.com/v1",
                temperature=0
            )
        elif provider == "ollama":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            log.info("[LLM] Using Ollama locally – model=%s  base_url=%s", model_name or "llama3", base_url)
            return ChatOllama(
                model=model_name or "llama3",
                base_url=base_url,
                temperature=0
            )
        else:
            log.error("[LLM] Unsupported provider requested: '%s'", provider)
            raise ValueError(f"Unsupported provider: {provider}")

    def generate_query(self, question, schema, db_type="postgresql", provider="gemini", model_name=None):
        """Generates either a SQL query or MQL JSON based on the database type."""
        log.info("[QUERY_GEN] ── Starting query generation ──────────────────")
        log.info("[QUERY_GEN] db_type='%s'  provider='%s'  model='%s'", db_type, provider, model_name)
        log.info("[QUERY_GEN] User question: %s", question)
        log.debug("[QUERY_GEN] Schema passed to LLM (first 500 chars):\n%s", schema[:500])

        llm = self.get_llm(provider, model_name)

        prompt_map = {
            "mongodb":       self.mql_prompt,
            "snowflake":     self.snowflake_prompt,
            "mysql":         self.mysql_prompt,
            "elasticsearch": self.elasticsearch_prompt,
            "neo4j":         self.neo4j_prompt,
        }
        prompt = prompt_map.get(db_type, self.sql_prompt)
        log.debug("[QUERY_GEN] Using prompt template for db_type='%s'", db_type)
        chain = prompt | llm | self.parser

        t0 = time.perf_counter()
        result = chain.invoke({"question": question, "schema": schema})
        elapsed = time.perf_counter() - t0

        # Clean up any potential markdown formatting
        cleaned = result.strip().replace("```sql", "").replace("```json", "").replace("```", "").strip()
        log.info("[QUERY_GEN] LLM responded in %.2fs", elapsed)
        log.info("[QUERY_GEN] Generated query:\n%s", cleaned)
        return cleaned

    def generate_suggestions(self, history_text, schema, provider="gemini", model_name=None):
        """Generates relevant follow-up questions based on history and schema."""
        log.info("[SUGGESTIONS] Generating follow-up suggestions – provider='%s'", provider)
        prompt = ChatPromptTemplate.from_template("""
        You are a data analyst assistant. Based on the previous conversation history and the database schema provided, suggest 3-4 concise, highly relevant natural language questions the user might want to ask next.
        
        Schema:
        {schema}
        
        Recent History:
        {history}
        
        Rules:
        1. Return ONLY the questions, one per line.
        2. Do not include numbering, bullets, or any introductory text.
        3. Each suggestion must be a direct question in plain English.
        4. Focus on deep-diving into the data already discussed.
        """)
        llm = self.get_llm(provider, model_name)
        chain = prompt | llm | self.parser

        t0 = time.perf_counter()
        response = chain.invoke({"history": history_text, "schema": schema})
        elapsed = time.perf_counter() - t0
        log.debug("[SUGGESTIONS] LLM responded in %.2fs", elapsed)

        # Split by newline and clean up
        suggestions = [q.strip() for q in response.split("\n") if q.strip()]
        # Remove common prefixes like "- ", "1. ", etc if they exist
        cleaned = []
        for s in suggestions:
            s = s.lstrip("- ").lstrip("1. ").lstrip("2. ").lstrip("3. ").lstrip("4. ").strip()
            if s: cleaned.append(s)
        result = cleaned[:4]
        log.info("[SUGGESTIONS] Returning %d suggestions: %s", len(result), result)
        return result

    def summarize_conversation(self, question, response_text, provider="gemini", model_name=None):
        """Generates a short, 3-5 word title for a conversation."""
        log.info("[SUMMARIZE] Generating conversation title – provider='%s'", provider)
        prompt = ChatPromptTemplate.from_template("""
        You are a helpful assistant. Summarize the following user question and your response into a concise, professional title of 3-5 words.
        
        Question: {question}
        Response: {response}
        
        Rules:
        1. Return ONLY the title.
        2. No punctuation at the end.
        3. Do not use quotes.
        4. Focus on the core subject of the data inquiry.
        """)
        llm = self.get_llm(provider, model_name)
        chain = prompt | llm | self.parser

        t0 = time.perf_counter()
        title = chain.invoke({"question": question, "response": response_text})
        elapsed = time.perf_counter() - t0
        title = title.strip().strip('"').strip("'")
        log.info("[SUMMARIZE] Title generated in %.2fs: '%s'", elapsed, title)
        return title

    def synthesize_answer(self, question, headers, rows, provider="gemini", model_name=None):
        """Synthesizes a natural language answer based on query results."""
        log.info("[SYNTHESIZE] Building natural language answer – provider='%s'", provider)
        log.info("[SYNTHESIZE] Result set: %d rows × %d columns", len(rows), len(headers))
        try:
            llm = self.get_llm(provider, model_name)
            chain = self.synthesize_prompt | llm | self.parser

            # Truncate row count to save tokens – keep first 30 rows for synthesis
            truncated_rows = rows[:30]
            if len(rows) > 30:
                log.warning("[SYNTHESIZE] Result has %d rows – truncating to 30 for LLM synthesis", len(rows))

            t0 = time.perf_counter()
            response = chain.invoke({
                "question": question,
                "headers": json.dumps(headers),
                "rows": json.dumps(truncated_rows)
            })
            elapsed = time.perf_counter() - t0
            log.info("[SYNTHESIZE] Answer synthesized in %.2fs (%d chars)", elapsed, len(response))
            return response.strip()
        except Exception as e:
            log.error("[SYNTHESIZE] Failed to synthesize answer: %s", e, exc_info=True)
            return None
