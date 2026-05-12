# pyrefly: ignore [missing-import]
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from config import LLM_PROVIDER, LLM_MODEL, GEMINI_API_KEY, DEEPSEEK_API_KEY
import os

def get_llm(provider=None):
    selected_provider = (provider or LLM_PROVIDER).lower()
    
    if selected_provider == "deepseek":
        # Ensure model name is set correctly for deepseek
        model_name = "deepseek-chat" if LLM_MODEL == "gemini-flash-latest" else LLM_MODEL
        return ChatOpenAI(
            model=model_name,
            api_key=DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/v1"
        )
    else:
        # Default to Gemini
        return ChatGoogleGenerativeAI(
            model=LLM_MODEL,
            google_api_key=GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        )
