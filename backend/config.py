import os
from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _env_int(name: str) -> int:
    return int(_require_env(name))


# Database configuration
DB_USER = _require_env("DB_USER")
DB_PASSWORD = _require_env("DB_PASSWORD")
DB_HOST = _require_env("DB_HOST")
DB_NAME = _require_env("DB_NAME")
DB_PORT = _require_env("DB_PORT")
DATABASE_URL = os.getenv("DATABASE_URL") or f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# LLM configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = _require_env("GROQ_MODEL")
DEEPSEEK_MODEL = _require_env("DEEPSEEK_MODEL")
DEEPSEEK_BASE_URL = _require_env("DEEPSEEK_BASE_URL")
OLLAMA_BASE_URL = _require_env("OLLAMA_BASE_URL")
OLLAMA_MODEL = _require_env("OLLAMA_MODEL")
LLM_PROVIDER = _require_env("LLM_PROVIDER").lower()
LLM_MODEL = _require_env("LLM_MODEL")
LLM_FALLBACK_PROVIDERS = [
    provider.strip().lower()
    for provider in _require_env("LLM_FALLBACK_PROVIDERS").split(",")
    if provider.strip()
]
SYNTHESIS_ROW_LIMIT = _env_int("SYNTHESIS_ROW_LIMIT")
STREAM_TOKEN_TIMEOUT_SECONDS = _env_int("STREAM_TOKEN_TIMEOUT_SECONDS")
SYNTHESIS_FAILURE_MESSAGE = _require_env("SYNTHESIS_FAILURE_MESSAGE")

# App/runtime configuration
JWT_SECRET = _require_env("JWT_SECRET")
ALLOWED_ORIGINS = [origin.strip() for origin in _require_env("ALLOWED_ORIGINS").split(",") if origin.strip()]
ASK_RATE_LIMIT = _require_env("ASK_RATE_LIMIT")
SUGGEST_RATE_LIMIT = _require_env("SUGGEST_RATE_LIMIT")
DASHBOARD_RATE_LIMIT = _require_env("DASHBOARD_RATE_LIMIT")
EXPLAIN_RATE_LIMIT = _require_env("EXPLAIN_RATE_LIMIT")
OPTIMIZE_RATE_LIMIT = _require_env("OPTIMIZE_RATE_LIMIT")
DB_QUERY_MAX_RETRIES = _env_int("DB_QUERY_MAX_RETRIES")
SUGGEST_HISTORY_LIMIT = _env_int("SUGGEST_HISTORY_LIMIT")
SUGGEST_ASSISTANT_MAX_CHARS = _env_int("SUGGEST_ASSISTANT_MAX_CHARS")
UVICORN_HOST = _require_env("UVICORN_HOST")
UVICORN_PORT = _env_int("UVICORN_PORT")

# Schema cache + connection robustness (optional; safe defaults)
SCHEMA_CACHE_TTL_SECONDS = int(os.getenv("SCHEMA_CACHE_TTL_SECONDS", "300"))
DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "10"))
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
DB_POOL_MAX_OVERFLOW = int(os.getenv("DB_POOL_MAX_OVERFLOW", "10"))
