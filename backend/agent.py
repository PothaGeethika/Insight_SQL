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
        2. If the results contain 5 or fewer records, format your response clearly using clear, clean bullet points (not a raw dump of JSON fields).
           Example format:
           Found X shipment(s) matching your criteria:
           
           - **Shipment ID:** SHIP-10001
             - **Status:** In Transit
             - **Origin:** Mumbai
             
        3. CRITICAL: If the results contain MORE than 5 records, or if the records appear to be full-table dumps or raw JSON data, DO NOT list out all the records. Instead, provide a brief 1-2 sentence summary (e.g., "I have fetched the complete table data.") and instruct the user to "expand the Results table below to view all the records."
        4. Focus on key, high-level attributes rather than nesting every single subfield unless specifically asked.
        5. When listing database schemas or data types, always simplify technical database types into common, user-friendly terms (e.g., use "String" instead of "character varying", "Date/Time" instead of "timestamp with time zone", "Number" instead of "integer").
        6. Do not mention technical implementation details like SQL, MQL, or Elasticsearch syntax.
        
        Assistant Response:
        """)

    def get_llm(self, provider, model_name=None, temperature=0):
        log.debug("[LLM] Selecting provider='%s' model='%s' temp=%s", provider, model_name, temperature)
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                log.error("[LLM] GEMINI_API_KEY is not set in environment!")
            log.info("[LLM] Using Google Gemini – model=%s", model_name or "gemini-2.0-flash")
            return ChatGoogleGenerativeAI(
                model=model_name or "gemini-2.0-flash",
                google_api_key=api_key,
                temperature=temperature
            )
        elif provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                log.error("[LLM] GROQ_API_KEY is not set in environment!")
            log.info("[LLM] Using Groq – model=%s", model_name or "llama-3.1-70b-versatile")
            return ChatGroq(
                model=model_name or "llama-3.1-70b-versatile",
                groq_api_key=api_key,
                temperature=temperature
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
                temperature=temperature
            )
        elif provider == "ollama":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            log.info("[LLM] Using Ollama locally – model=%s  base_url=%s", model_name or "llama3", base_url)
            return ChatOllama(
                model=model_name or "llama3",
                base_url=base_url,
                temperature=temperature
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

        llm = self.get_llm(provider, model_name, temperature=0)

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
        You are a data analyst assistant. Based on the previous conversation history and the database schema provided, suggest 4 concise, highly relevant natural language questions the user might want to ask next.
        Make the questions diverse and varied.
        
        Schema:
        {schema}
        
        History:
        {history_text}
        
        Rules:
        1. Output ONLY a valid JSON array of 4 strings (the questions).
        2. Do not include any explanations or markdown formatting like ```json.
        3. Example: ["How many users are there?", "What is the total revenue?", "Show the latest orders", "Which products sell the most?"]
        
        Output:
        """)
        llm = self.get_llm(provider, model_name, temperature=0.7)
        chain = prompt | llm | self.parser

        t0 = time.perf_counter()
        response = chain.invoke({"history_text": history_text, "schema": schema})
        elapsed = time.perf_counter() - t0
        log.debug("[SUGGESTIONS] LLM responded in %.2fs", elapsed)

        try:
            cleaned_response = response.strip().replace("```json", "").replace("```", "").strip()
            suggestions_list = json.loads(cleaned_response)
            if isinstance(suggestions_list, list):
                result = [str(s).strip() for s in suggestions_list if str(s).strip()][:4]
                log.info("[SUGGESTIONS] Returning %d suggestions: %s", len(result), result)
                return result
        except Exception as e:
            log.error("[SUGGESTIONS] JSON parse error: %s. Raw response: %s", e, response)
            
        return []

    def generate_dashboard_queries(self, schema, provider="gemini", model_name=None):
        """Generates 4 diverse SQL queries for a dashboard based on the schema."""
        log.info("[DASHBOARD] Generating dashboard queries – provider='%s'", provider)
        prompt = ChatPromptTemplate.from_template("""
        You are an expert Data Analyst. Given the database schema below, generate 4 distinct, insightful SQL queries that would make a great analytical dashboard.
        
        Requirements for the 4 queries:
        1. One should be a KPI/metric (e.g., total users, total sales) -> chartType: "bar" or "pie"
        2. One should be a time-series trend (e.g., registrations by month) -> chartType: "line" or "area"
        3. One should be a categorical breakdown (e.g., users by role/status) -> chartType: "pie"
        4. One should be a top-N ranking (e.g., top 5 most active users/products) -> chartType: "bar"
        
        Schema:
        {schema}
        
        Rules:
        1. Output ONLY a valid JSON array of exactly 4 objects.
        2. Each object must have: 
           - "title" (string, short descriptive title)
           - "query" (string, the valid SQL query compatible with standard SQL/Postgres)
           - "chartType" (string, one of: "bar", "line", "pie", "area")
        3. Do not include any markdown formatting like ```json.
        
        Output:
        """)
        llm = self.get_llm(provider, model_name, temperature=0.7)
        chain = prompt | llm | self.parser

        t0 = time.perf_counter()
        response = chain.invoke({"schema": schema})
        elapsed = time.perf_counter() - t0
        log.debug("[DASHBOARD] LLM responded in %.2fs", elapsed)

        try:
            cleaned_response = response.strip().replace("```json", "").replace("```", "").strip()
            queries = json.loads(cleaned_response)
            if isinstance(queries, list):
                log.info("[DASHBOARD] Successfully parsed %d dashboard queries.", len(queries))
                return queries
        except Exception as e:
            log.error("[DASHBOARD] JSON parse error: %s. Raw response: %s", e, response)
            
        return []

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
