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
from config import (
    DB_QUERY_MAX_RETRIES,
    GEMINI_API_KEY,
    GROQ_API_KEY,
    GROQ_MODEL,
    DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL,
    DEEPSEEK_BASE_URL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    LLM_MODEL,
    LLM_FALLBACK_PROVIDERS,
    SYNTHESIS_ROW_LIMIT,
    STREAM_TOKEN_TIMEOUT_SECONDS,
    SYNTHESIS_FAILURE_MESSAGE,
)

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
        4. Prefer schema-qualified names when the schema is not public (e.g. sales.orders).
        5. Read-only SELECT/WITH queries only — never INSERT/UPDATE/DELETE/DDL.
        
        Examples:
        Q: How many users signed up last month?
        A: SELECT COUNT(*) AS user_count FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE);
        Q: Top 5 products by revenue
        A: SELECT p.name, SUM(oi.quantity * oi.unit_price) AS revenue FROM order_items oi JOIN products p ON p.id = oi.product_id GROUP BY p.name ORDER BY revenue DESC LIMIT 5;
        
        SQL Query:
        """)

        self.mysql_prompt = ChatPromptTemplate.from_template("""
        You are an expert MySQL developer. Given the database schema below, convert the user's natural language question into a valid MySQL query.
        
        Schema:
        {schema}
        
        Question: {question}
        
        Rules:
        1. Only return the SQL query. Do not include any explanations or markdown blocks like ```sql.
        2. Ensure the query is compatible with MySQL (use IFNULL, DATE_SUB, LIMIT).
        3. Use table aliases for clarity if joining multiple tables.
        4. Read-only SELECT/WITH queries only — never INSERT/UPDATE/DELETE/DDL.
        
        Examples:
        Q: Count orders by status
        A: SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status ORDER BY cnt DESC;
        Q: Customers created in the last 7 days
        A: SELECT id, email, created_at FROM customers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
        
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
        2. Use valid Snowflake SQL (ILIKE for case-insensitive match, LIMIT supported, QUALIFY for window filters).
        3. Use fully qualified table names if needed (DATABASE.SCHEMA.TABLE).
        4. Use table aliases for clarity if joining multiple tables.
        5. Read-only SELECT/WITH queries only.
        
        Examples:
        Q: Revenue by month
        A: SELECT DATE_TRUNC('month', order_date) AS month, SUM(amount) AS revenue FROM orders GROUP BY 1 ORDER BY 1;
        Q: Find customers whose email contains acme
        A: SELECT * FROM customers WHERE email ILIKE '%acme%' LIMIT 100;
        
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
        4. Only use actions find, aggregate, or count (never insert/update/delete).
        
        Examples:
        Q: Count users in the users collection
        A: {{"collection":"users","action":"count","query":{{}}}}
        Q: Find active shipments limited to 50
        A: {{"collection":"shipments","action":"find","query":{{"status":"active"}},"limit":50}}
        Q: Group orders by status
        A: {{"collection":"orders","action":"aggregate","pipeline":[{{"$group":{{"_id":"$status","count":{{"$sum":1}}}}}}]}}
        
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
        
        Examples:
        Q: Find documents mentioning logistics in the shipments index
        A: {{"index":"shipments","body":{{"query":{{"match":{{"description":"logistics"}}}},"size":50}}}}
        Q: Count docs with status delivered
        A: {{"index":"shipments","body":{{"size":0,"query":{{"term":{{"status.keyword":"delivered"}}}},"aggs":{{"by_status":{{"value_count":{{"field":"_id"}}}}}}}}}}
        
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
        4. Read-only only — never CREATE/MERGE/DELETE/SET/REMOVE.
        
        Examples:
        Q: List all Person nodes
        A: MATCH (p:Person) RETURN p LIMIT 100
        Q: Find friends of Alice
        A: MATCH (a:Person {{name: 'Alice'}})-[:FRIENDS_WITH]->(b:Person) RETURN b.name AS friend
        
        Cypher Query:
        """)

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
        self.parser = StrOutputParser()

    def _has_provider_credentials(self, provider: str) -> bool:
        if provider == "gemini":
            return bool(GEMINI_API_KEY)
        if provider == "groq":
            return bool(GROQ_API_KEY) and not GROQ_API_KEY.startswith("ssh-")
        if provider == "deepseek":
            return bool(DEEPSEEK_API_KEY)
        if provider == "ollama":
            return bool(OLLAMA_BASE_URL)
        return False

    def _default_model_for_provider(self, provider: str) -> str:
        model_map = {
            "gemini": LLM_MODEL,
            "groq": GROQ_MODEL,
            "deepseek": DEEPSEEK_MODEL,
            "ollama": OLLAMA_MODEL,
        }
        return model_map[provider]

    def _provider_attempt_order(self, provider: str) -> list[str]:
        order: list[str] = []
        for candidate in [provider, *LLM_FALLBACK_PROVIDERS]:
            if candidate not in order and self._has_provider_credentials(candidate):
                order.append(candidate)
        return order

    def _invoke_chain_with_fallback(self, prompt_template, inputs, provider, model_name=None, temperature=0):
        last_error = None
        for attempt_provider in self._provider_attempt_order(provider):
            attempt_model = model_name if attempt_provider == provider else self._default_model_for_provider(attempt_provider)
            try:
                llm = self.get_llm(attempt_provider, attempt_model, temperature)
                chain = prompt_template | llm | self.parser
                log.info("[LLM] Invoking provider='%s' model='%s'", attempt_provider, attempt_model)
                return chain.invoke(inputs)
            except Exception as exc:
                log.warning("[LLM] Provider '%s' failed: %s", attempt_provider, exc)
                last_error = exc
        if last_error:
            raise last_error
        raise RuntimeError("No configured LLM providers are available.")

    def get_llm(self, provider, model_name=None, temperature=0):
        log.debug("[LLM] Selecting provider='%s' model='%s' temp=%s", provider, model_name, temperature)
        if provider not in ["gemini", "groq", "deepseek", "ollama"]:
            log.warning("[LLM] Provider '%s' unsupported. Using configured fallback providers.", provider)
            available = self._provider_attempt_order(provider)
            if not available:
                raise RuntimeError(f"Unsupported provider '{provider}' and no fallback providers are configured.")
            provider = available[0]
            model_name = self._default_model_for_provider(provider)

        resolved_model = model_name or self._default_model_for_provider(provider)

        if provider == "gemini":
            if not GEMINI_API_KEY:
                raise RuntimeError("GEMINI_API_KEY is not set in environment.")
            log.info("[LLM] Using Google Gemini – model=%s", resolved_model)
            return ChatGoogleGenerativeAI(
                model=resolved_model,
                google_api_key=GEMINI_API_KEY,
                temperature=temperature,
                max_retries=0,
            )
        if provider == "groq":
            if not GROQ_API_KEY:
                raise RuntimeError("GROQ_API_KEY is not set in environment.")
            log.info("[LLM] Using Groq – model=%s", resolved_model)
            return ChatGroq(
                model=resolved_model,
                groq_api_key=GROQ_API_KEY,
                temperature=temperature,
                max_retries=0,
            )
        if provider == "deepseek":
            if not DEEPSEEK_API_KEY:
                raise RuntimeError("DEEPSEEK_API_KEY is not set in environment.")
            log.info("[LLM] Using DeepSeek – model=%s", resolved_model)
            return ChatOpenAI(
                model=resolved_model,
                api_key=DEEPSEEK_API_KEY,
                base_url=DEEPSEEK_BASE_URL,
                temperature=temperature,
                max_retries=0,
            )
        if provider == "ollama":
            log.info("[LLM] Using Ollama locally – model=%s  base_url=%s", resolved_model, OLLAMA_BASE_URL)
            return ChatOllama(
                model=resolved_model,
                base_url=OLLAMA_BASE_URL,
                temperature=temperature,
            )
        raise RuntimeError(f"Unsupported provider '{provider}'.")

    def generate_query(self, question, schema, db_type="postgresql", provider="gemini", model_name=None):
        """Generates either a SQL query or MQL JSON based on the database type."""
        log.info("[QUERY_GEN] ── Starting query generation ──────────────────")
        log.info("[QUERY_GEN] db_type='%s'  provider='%s'  model='%s'", db_type, provider, model_name)
        log.info("[QUERY_GEN] User question: %s", question)
        log.debug("[QUERY_GEN] Schema passed to LLM (first 500 chars):\n%s", schema[:500])

        prompt_map = {
            "mongodb":       self.mql_prompt,
            "snowflake":     self.snowflake_prompt,
            "mysql":         self.mysql_prompt,
            "elasticsearch": self.elasticsearch_prompt,
            "neo4j":         self.neo4j_prompt,
        }
        prompt = prompt_map.get(db_type, self.sql_prompt)
        log.debug("[QUERY_GEN] Using prompt template for db_type='%s'", db_type)

        t0 = time.perf_counter()
        result = self._invoke_chain_with_fallback(
            prompt,
            {"question": question, "schema": schema},
            provider,
            model_name,
            temperature=0,
        )
        elapsed = time.perf_counter() - t0

        # Clean up any potential markdown formatting
        cleaned = result.strip().replace("```sql", "").replace("```json", "").replace("```", "").strip()
        log.info("[QUERY_GEN] LLM responded in %.2fs", elapsed)
        log.info("[QUERY_GEN] Generated query:\n%s", cleaned)
        return cleaned

    def fix_query(self, question, schema, wrong_query, error_message, db_type="postgresql", provider="gemini", model_name=None):
        """Self-healing loop: asks the LLM to fix a query that failed to execute."""
        log.info("[QUERY_FIX] ── Attempting to self-heal query ──────────────────")

        fix_prompt = ChatPromptTemplate.from_template("""
        You are a data analyst assistant. You previously generated a query that resulted in an execution error.
        Please fix the query so that it executes successfully.
        
        Database Type: {db_type}
        
        Schema:
        {schema}
        
        Original User Question:
        {question}
        
        The query you generated:
        {wrong_query}
        
        The error message returned by the database:
        {error_message}
        
        Provide ONLY the corrected raw query (SQL or MQL JSON) without any markdown formatting or explanations.
        """)

        t0 = time.perf_counter()
        result = self._invoke_chain_with_fallback(
            fix_prompt,
            {
                "db_type": db_type,
                "schema": schema,
                "question": question,
                "wrong_query": wrong_query,
                "error_message": str(error_message),
            },
            provider,
            model_name,
            temperature=0,
        )
        elapsed = time.perf_counter() - t0

        cleaned = result.strip().replace("```sql", "").replace("```json", "").replace("```", "").strip()
        log.info("[QUERY_FIX] Fixed query generated in %.2fs:\n%s", elapsed, cleaned)
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

        t0 = time.perf_counter()
        try:
            response = self._invoke_chain_with_fallback(
                prompt,
                {"history_text": history_text, "schema": schema},
                provider,
                model_name,
                temperature=0.7,
            )
        except Exception as err:
            log.error("[SUGGESTIONS] All providers failed: %s", err)
            return [
                "Show database tables list",
                "Count total records in main table",
                "Preview first 10 rows of active table",
                "Explain the database schema"
            ]

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
            
        return [
            "Show database tables list",
            "Count total records in main table",
            "Preview first 10 rows of active table",
            "Explain the database schema"
        ]

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

        t0 = time.perf_counter()
        try:
            response = self._invoke_chain_with_fallback(
                prompt,
                {"schema": schema},
                provider,
                model_name,
                temperature=0.7,
            )
        except Exception as err:
            log.error("[DASHBOARD] All providers failed: %s", err)
            return []

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

        t0 = time.perf_counter()
        try:
            title = self._invoke_chain_with_fallback(
                prompt,
                {"question": question, "response": response_text},
                provider,
                model_name,
            )
        except Exception as err:
            log.error("[SUMMARIZE] All providers failed: %s", err)
            return "Data Query Summary"

        elapsed = time.perf_counter() - t0
        title = title.strip().strip('"').strip("'")
        log.info("[SUMMARIZE] Title generated in %.2fs: '%s'", elapsed, title)
        return title

    async def synthesize_answer_stream(self, question, headers, rows, provider="gemini", model_name=None):
        """Streams the natural language answer token by token using an async generator."""
        import asyncio
        from langchain_core.callbacks import AsyncCallbackHandler

        class _TokenQueue(AsyncCallbackHandler):
            def __init__(self):
                self.queue: asyncio.Queue = asyncio.Queue()

            async def on_llm_new_token(self, token: str, **kwargs):
                await self.queue.put(token)

            async def on_llm_end(self, *args, **kwargs):
                await self.queue.put(None)  # sentinel

            async def on_llm_error(self, error, **kwargs):
                await self.queue.put(None)

        handler = _TokenQueue()
        truncated_rows = rows[:SYNTHESIS_ROW_LIMIT]
        payload = {
            "question": question,
            "headers": json.dumps(headers),
            "rows": json.dumps(truncated_rows),
        }

        for attempt_provider in self._provider_attempt_order(provider):
            attempt_model = model_name if attempt_provider == provider else self._default_model_for_provider(attempt_provider)
            try:
                llm = self.get_llm(attempt_provider, attempt_model, temperature=0)
                llm.streaming = True
                chain = self.synthesize_prompt | llm | self.parser
                asyncio.ensure_future(
                    chain.ainvoke(payload, config={"callbacks": [handler]})
                )

                while True:
                    token = await asyncio.wait_for(handler.queue.get(), timeout=STREAM_TOKEN_TIMEOUT_SECONDS)
                    if token is None:
                        return
                    yield token
            except Exception as exc:
                log.warning("[SYNTHESIZE_STREAM] Provider '%s' failed: %s", attempt_provider, exc)
                handler = _TokenQueue()

        fallback_text = self.synthesize_answer(question, headers, rows, provider, model_name)
        yield fallback_text

    def synthesize_answer(self, question, headers, rows, provider="gemini", model_name=None):
        """Synthesizes a natural language answer based on query results."""
        log.info("[SYNTHESIZE] Building natural language answer – provider='%s'", provider)
        log.info("[SYNTHESIZE] Result set: %d rows × %d columns", len(rows), len(headers))
        
        truncated_rows = rows[:SYNTHESIS_ROW_LIMIT]
        if len(rows) > SYNTHESIS_ROW_LIMIT:
            log.warning("[SYNTHESIZE] Result has %d rows – truncating to %d for LLM synthesis", len(rows), SYNTHESIS_ROW_LIMIT)

        try:
            t0 = time.perf_counter()
            response = self._invoke_chain_with_fallback(
                self.synthesize_prompt,
                {
                    "question": question,
                    "headers": json.dumps(headers),
                    "rows": json.dumps(truncated_rows),
                },
                provider,
                model_name,
            )
            elapsed = time.perf_counter() - t0
            log.info("[SYNTHESIZE] Answer synthesized in %.2fs (%d chars)", elapsed, len(response))
            return response.strip()
        except Exception as err:
            log.error("[SYNTHESIZE] All providers failed: %s", err, exc_info=True)
            return SYNTHESIS_FAILURE_MESSAGE.format(row_count=len(rows))

    def optimize_query(self, query, explain_json, schema, provider="gemini", model_name=None):
        """Analyzes a slow query and its execution plan, and suggests optimizations."""
        log.info("[OPTIMIZE] ── Analyzing slow query execution plan ──────────────────")
        
        optimize_prompt = ChatPromptTemplate.from_template("""
        You are a Senior Database Administrator. Analyze the following slow SQL query and its execution plan.
        Identify the primary bottlenecks (e.g., Sequential/Full Table Scans, Nested Loops).
        Suggest actionable optimizations, particularly indexing strategies or query rewrites.
        
        Schema:
        {schema}
        
        Slow Query:
        {query}
        
        Execution Plan (JSON):
        {explain_json}
        
        Please format your response as a JSON object with two fields:
        1. "analysis": A clear, concise explanation of the bottleneck.
        2. "recommendation": The specific SQL statement to fix it (e.g., CREATE INDEX ...). If rewriting the query is better, provide the rewritten query.
        
        Output ONLY the JSON object. Do not include markdown formatting like ```json.
        """)
        
        t0 = time.perf_counter()
        result = self._invoke_chain_with_fallback(
            optimize_prompt,
            {
                "query": query,
                "explain_json": json.dumps(explain_json),
                "schema": schema,
            },
            provider,
            model_name,
            temperature=0,
        )
        elapsed = time.perf_counter() - t0
        
        cleaned = result.strip().replace("```json", "").replace("```", "").strip()
        log.info("[OPTIMIZE] Optimization suggestion generated in %.2fs", elapsed)
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            log.error("[OPTIMIZE] Failed to parse JSON from LLM: %s", cleaned)
            return {
                "analysis": "Could not parse analysis. The query may require missing indexes.",
                "recommendation": "-- Unable to generate specific recommendation."
            }

