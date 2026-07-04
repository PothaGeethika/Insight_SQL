import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timedelta
import random

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

def seed():
    try:
        print(f"Connecting to {DB_NAME} at {DB_HOST} as {DB_USER}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        conn.autocommit = True
        cursor = conn.cursor()

        print("Connected! Creating tables...")

        cursor.execute("""
            DROP TABLE IF EXISTS shipments CASCADE;
            DROP TABLE IF EXISTS inventory CASCADE;
            DROP TABLE IF EXISTS warehouses CASCADE;
            DROP TABLE IF EXISTS products CASCADE;
            DROP TABLE IF EXISTS suppliers CASCADE;

            CREATE TABLE suppliers (
                supplier_id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                country VARCHAR(100) NOT NULL,
                contact_email VARCHAR(255)
            );

            CREATE TABLE products (
                product_id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL,
                supplier_id INT REFERENCES suppliers(supplier_id)
            );

            CREATE TABLE warehouses (
                warehouse_id SERIAL PRIMARY KEY,
                location VARCHAR(255) NOT NULL,
                capacity INT NOT NULL
            );

            CREATE TABLE inventory (
                inventory_id SERIAL PRIMARY KEY,
                product_id INT REFERENCES products(product_id),
                warehouse_id INT REFERENCES warehouses(warehouse_id),
                quantity INT NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE shipments (
                shipment_id SERIAL PRIMARY KEY,
                product_id INT REFERENCES products(product_id),
                origin_warehouse_id INT REFERENCES warehouses(warehouse_id),
                destination VARCHAR(255) NOT NULL,
                quantity INT NOT NULL,
                status VARCHAR(50) NOT NULL,
                dispatch_date DATE NOT NULL,
                delivery_date DATE
            );
        """)

        print("Tables created. Inserting mock logistics data...")

        suppliers = [
            ("Global Electronics Ltd", "China", "contact@globalelec.cn"),
            ("Steel & Co", "Germany", "info@steelco.de"),
            ("AgriFoods International", "Brazil", "sales@agrifoods.br"),
            ("TechParts Inc", "Taiwan", "supply@techparts.tw"),
            ("BioPharma Logistics", "USA", "logistics@biopharma.com")
        ]
        for s in suppliers:
            cursor.execute("INSERT INTO suppliers (name, country, contact_email) VALUES (%s, %s, %s)", s)

        products = [
            ("Smartphone OLED Display", "Electronics", 45.00, 1),
            ("Lithium-Ion Battery Pack", "Electronics", 12.50, 4),
            ("Industrial Steel Coil", "Raw Materials", 1200.00, 2),
            ("Soybean Bulk Sack", "Agriculture", 35.00, 3),
            ("Antibiotic Vials", "Pharmaceuticals", 15.00, 5),
            ("Microcontrollers", "Electronics", 2.50, 4),
            ("Aluminum Sheets", "Raw Materials", 450.00, 2)
        ]
        for p in products:
            cursor.execute("INSERT INTO products (name, category, unit_price, supplier_id) VALUES (%s, %s, %s, %s)", p)

        warehouses = [
            ("Hamburg Port, Germany", 50000),
            ("Shanghai Hub, China", 120000),
            ("Santos Port, Brazil", 80000),
            ("Los Angeles Central, USA", 95000)
        ]
        for w in warehouses:
            cursor.execute("INSERT INTO warehouses (location, capacity) VALUES (%s, %s)", w)

        for product_id in range(1, len(products) + 1):
            for warehouse_id in range(1, len(warehouses) + 1):
                quantity = random.randint(100, 5000)
                cursor.execute("INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (%s, %s, %s)",
                               (product_id, warehouse_id, quantity))

        statuses = ["Delivered", "In Transit", "Pending", "Delayed"]
        for _ in range(50):
            product_id = random.randint(1, len(products))
            warehouse_id = random.randint(1, len(warehouses))
            quantity = random.randint(50, 1000)
            status = random.choice(statuses)
            dispatch_date = datetime.now() - timedelta(days=random.randint(1, 30))
            delivery_date = dispatch_date + timedelta(days=random.randint(2, 14)) if status == "Delivered" else None
            
            destinations = ["New York", "London", "Tokyo", "Berlin", "Sydney", "Mumbai", "Dubai", "Singapore"]
            destination = random.choice(destinations)

            cursor.execute("""
                INSERT INTO shipments (product_id, origin_warehouse_id, destination, quantity, status, dispatch_date, delivery_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (product_id, warehouse_id, destination, quantity, status, dispatch_date.date(), delivery_date.date() if delivery_date else None))

        print("Data insertion complete! All tables are populated.")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    seed()
