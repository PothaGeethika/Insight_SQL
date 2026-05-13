from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, List
from schema import get_schema
from sql_generator import generate_sql
from executor import execute_sql
from translator import translate_to_english
from llm_factory import get_llm
from config import LLM_MODEL
import psycopg2
from dotenv import load_dotenv
import os
from logger_config import logger

load_dotenv()


# Database connection
def get_db_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

# State
class AgentState(TypedDict):
    question: str
    schema: str
    sql: str
    result: Optional[List]
    error: Optional[str]
    retries: int
    answer: str
    provider: Optional[str]

# Nodes
def schema_node(state):
    logger.info("Node: Fetching Database Schema")
    conn = get_db_conn()
    schema = get_schema(conn)
    conn.close()
    return {"schema": schema}
    # print(schema,"shemaa------")
    # input(">>>>>>>>>>>>>>>>>>>>>>>>>")

def sql_node(state):
    logger.info(f"Node: Generating SQL using {state.get('provider', 'default')}")
    llm = get_llm(state.get("provider"))
    sql = generate_sql(
        state["question"],
        state["schema"],
        llm
    )
    logger.info(f"Generated SQL: {sql}")
    return {
        "sql": sql,
        "retries": state["retries"] + 1
    }

def execute_node(state):
    logger.info("Node: Executing SQL")
    conn = get_db_conn()
    output = execute_sql(conn, state["sql"])
    conn.close()
    if output["success"]:
        logger.info(f"SQL execution successful. Rows: {len(output['data']) if isinstance(output['data'], list) else 1}")
        return {"result": output["data"], "error": None}
    else:
        logger.error(f"SQL execution failed: {output['error']}")
        return {"error": output["error"], "result": None}

def translate_node(state):
    logger.info(f"Node: Translating results using {state.get('provider', 'default')}")
    llm = get_llm(state.get("provider"))
    answer = translate_to_english(
        state["question"],
        state["result"],
        llm
    )
    logger.info(f"Final Answer Generated: {answer}")
    return {"answer": answer}

# Conditional edge
def should_retry(state):
    if state["error"] and state["retries"] < 3:
        logger.warning(f"Error detected. Retrying... (Attempt {state['retries']})")
        return "retry"
    elif state["error"]:
        logger.error("Max retries reached. Moving to finalization with error.")
        return "give_up"
    else:
        logger.info("Query successful. Proceeding to translation.")
        return "success"

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("schema", schema_node)
workflow.add_node("coder", sql_node)
workflow.add_node("database", execute_node)
workflow.add_node("translator", translate_node)

workflow.set_entry_point("schema")
workflow.add_edge("schema", "coder")
workflow.add_edge("coder", "database")
workflow.add_conditional_edges(
    "database",
    should_retry,
    {
        "retry": "coder",
        "success": "translator",
        "give_up": "translator"
    }
)
workflow.add_edge("translator", END)

app = workflow.compile()
