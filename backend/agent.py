import os
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

load_dotenv()

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
        self.parser = StrOutputParser()

    def get_llm(self, provider, model_name=None):
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            return ChatGoogleGenerativeAI(
                model=model_name or "gemini-1.5-flash",
                google_api_key=api_key,
                temperature=0
            )
        elif provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            return ChatGroq(
                model=model_name or "llama-3.1-70b-versatile",
                groq_api_key=api_key,
                temperature=0
            )
        elif provider == "deepseek":
            api_key = os.getenv("DEEPSEEK_API_KEY")
            return ChatOpenAI(
                model=model_name or "deepseek-chat",
                openai_api_key=api_key,
                openai_api_base="https://api.deepseek.com",
                temperature=0
            )
        elif provider == "ollama":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            return ChatOllama(
                model=model_name or "llama3",
                base_url=base_url,
                temperature=0
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    def generate_sql(self, question, schema, provider="gemini", model_name=None):
        """Generates a SQL query using the selected LLM provider."""
        llm = self.get_llm(provider, model_name)
        chain = self.sql_prompt | llm | self.parser
        
        sql = chain.invoke({
            "question": question,
            "schema": schema
        })
        # Clean up any potential markdown formatting
        return sql.strip().replace("```sql", "").replace("```", "")

    def generate_suggestions(self, history_text, schema, provider="gemini", model_name=None):
        """Generates relevant follow-up questions based on history and schema."""
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
        
        response = chain.invoke({
            "history": history_text,
            "schema": schema
        })
        
        # Split by newline and clean up
        suggestions = [q.strip() for q in response.split("\n") if q.strip()]
        # Remove common prefixes like "- ", "1. ", etc if they exist
        cleaned = []
        for s in suggestions:
            s = s.lstrip("- ").lstrip("1. ").lstrip("2. ").lstrip("3. ").lstrip("4. ").strip()
            if s: cleaned.append(s)
            
        return cleaned[:4]

    def summarize_conversation(self, question, response_text, provider="gemini", model_name=None):
        """Generates a short, 3-5 word title for a conversation."""
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
        
        title = chain.invoke({
            "question": question,
            "response": response_text
        })
        return title.strip().strip('"').strip("'")
