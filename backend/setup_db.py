import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

def setup_database():
    try:
        # Connect to default postgres database to create the new database
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database="postgres" # Connect to default first
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        db_name = os.getenv("DB_NAME", "insightsql_db")
        
        # Check if database exists
        cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{db_name}'")
        exists = cursor.fetchone()
        if not exists:
            print(f"Creating database {db_name}...")
            cursor.execute(f"CREATE DATABASE {db_name}")
        
        cursor.close()
        conn.close()

        # Connect to the new database to create tables
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=db_name
        )
        cursor = conn.cursor()

        print("Creating tables...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                city VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                category VARCHAR(50),
                price DECIMAL(10,2),
                stock INT
            );

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_id INT REFERENCES customers(id),
                product_id INT REFERENCES products(id),
                quantity INT,
                total_amount DECIMAL(10,2),
                order_date TIMESTAMP DEFAULT NOW()
            );
        """)

        print("Filling with dummy data...")
        # Check if data already exists to avoid duplicates
        cursor.execute("SELECT count(*) FROM customers")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO customers (name, email, city) VALUES
                ('Amit Sharma', 'amit@email.com', 'Mumbai'),
                ('Priya Singh', 'priya@email.com', 'Delhi'),
                ('Rahul Verma', 'rahul@email.com', 'Bangalore'),
                ('Sara Khan', 'sara@email.com', 'Hyderabad'),
                ('Vikram Patel', 'vikram@email.com', 'Chennai');

                INSERT INTO products (name, category, price, stock) VALUES
                ('Laptop', 'Electronics', 45000, 50),
                ('Phone', 'Electronics', 15000, 100),
                ('Tablet', 'Electronics', 25000, 30),
                ('Headphones', 'Accessories', 3000, 200),
                ('Smartwatch', 'Accessories', 8000, 75);

                INSERT INTO orders (customer_id, product_id, quantity, total_amount) VALUES
                (1, 1, 1, 45000),
                (2, 2, 2, 30000),
                (3, 3, 1, 25000),
                (4, 4, 3, 9000),
                (5, 5, 1, 8000),
                (1, 2, 1, 15000),
                (2, 5, 2, 16000);
            """)

        conn.commit()
        print("Database setup complete!")
        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Error setting up database: {e}")
        print("Make sure PostgreSQL is running and your .env credentials are correct.")

if __name__ == "__main__":
    setup_database()
