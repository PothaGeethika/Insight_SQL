# pyrefly: ignore [missing-import]
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
# pyrefly: ignore [missing-import]
from langchain_groq import ChatGroq
# pyrefly: ignore [missing-import]
from langchain_ollama import ChatOllama
from config import (
    LLM_PROVIDER, LLM_MODEL, GEMINI_API_KEY, 
    DEEPSEEK_API_KEY, GROQ_API_KEY, GROQ_MODEL,
    OLLAMA_BASE_URL, OLLAMA_MODEL
)
import os

def get_llm(provider=None):
    selected_provider = (provider or LLM_PROVIDER).lower()
    
    if selected_provider == "deepseek":
        model_name = "deepseek-chat" if LLM_MODEL == "gemini-flash-latest" else LLM_MODEL
        return ChatOpenAI(
            model=model_name,
            api_key=DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/v1"
        )
    elif selected_provider == "groq":
        return ChatGroq(
            api_key=GROQ_API_KEY or os.getenv("GROQ_API_KEY", ""),
            model=GROQ_MODEL
        )
    elif selected_provider == "ollama":
        return ChatOllama(
            base_url=OLLAMA_BASE_URL,
            model=OLLAMA_MODEL
        )
    else:
        # Default to Gemini
        return ChatGoogleGenerativeAI(
            model=LLM_MODEL,
            google_api_key=GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        )
