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
