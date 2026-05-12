from agent import app

def test():
    print("Invoking agent with test question...")
    try:
        result = app.invoke({
            "question": "Who are our top 3 customers by total spending?",
            "schema": "",
            "sql": "",
            "result": None,
            "error": None,
            "retries": 0,
            "answer": ""
        })
        print("\n--- Final Answer ---")
        print(result["answer"])
    except Exception as e:
        print(f"Error during agent invocation: {e}")

if __name__ == "__main__":
    test()
