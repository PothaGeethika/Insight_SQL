from fastapi import FastAPI
from pydantic import BaseModel
from agent import app as agent_app
from fastapi.middleware.cors import CORSMiddleware
from logger_config import logger
from typing import Optional

app = FastAPI()

# Add CORS middleware to allow requests from the HTML file
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Question(BaseModel):
    question: str
    provider: Optional[str] = None

@app.post("/ask")
def ask(q: Question):
    logger.info(f"API Request: '{q.question}' using provider: {q.provider or 'default'}")
    result = agent_app.invoke({
        "question": q.question,
        "schema": "",
        "sql": "",
        "result": None,
        "error": None,
        "retries": 0,
        "answer": "",
        "provider": q.provider
    })
    logger.info(f"API Response sent for: '{q.question}'")
    return {"answer": result["answer"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
