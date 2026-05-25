import sqlite3
import os
from logger_config import get_logger

log = get_logger("init_db")

def init_db():
    db_path = "insight_sql.db"
    log.info("[INIT_DB] Initialising SQLite database at %s", db_path)
    
    # Remove existing db if it exists
    if os.path.exists(db_path):
        log.info("[INIT_DB] Removing existing database file.")
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    log.info("[INIT_DB] Creating sample tables (customers, orders)...")
    cursor.execute("""
    CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        city TEXT
    )
    """)
    
    cursor.execute("""
    CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        product TEXT,
        amount REAL,
        order_date DATE,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
    """)
    
    # Insert sample data
    log.info("[INIT_DB] Inserting sample data into tables...")
    customers = [
        (1, 'Alice Johnson', 'alice@example.com', 'New York'),
        (2, 'Bob Smith', 'bob@example.com', 'San Francisco'),
        (3, 'Charlie Brown', 'charlie@example.com', 'Chicago'),
        (4, 'David Wilson', 'david@example.com', 'Seattle')
    ]
    cursor.executemany("INSERT INTO customers VALUES (?,?,?,?)", customers)
    
    orders = [
        (101, 1, 'Laptop', 1200.00, '2024-01-10'),
        (102, 1, 'Mouse', 25.00, '2024-01-15'),
        (103, 2, 'Monitor', 300.00, '2024-01-20'),
        (104, 3, 'Keyboard', 75.00, '2024-02-01'),
        (105, 4, 'Headphones', 150.00, '2024-02-10'),
        (106, 1, 'Desk Lamp', 45.00, '2024-02-15')
    ]
    cursor.executemany("INSERT INTO orders VALUES (?,?,?,?,?)", orders)
    
    conn.commit()
    conn.close()
    log.info("[INIT_DB] Sample database created successfully at: %s", os.path.abspath(db_path))
    log.info("[INIT_DB] Update your .env to: DATABASE_URL=sqlite:///insight_sql.db")

if __name__ == "__main__":
    init_db()
