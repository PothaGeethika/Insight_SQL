import psycopg2
from config import DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DATABASE_URL
import sys

def validate_database():
    print("--- Database Validation Script ---")
    print(f"Connecting to: {DB_HOST}/{DB_NAME} as {DB_USER}...")
    
    try:
        # Test basic connection
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        print("✅ Successfully connected to the database.")
        
        cursor = conn.cursor()
        
        # Check for tables
        tables = ['customers', 'products', 'orders']
        print("\nChecking tables:")
        for table in tables:
            cursor.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}');")
            exists = cursor.fetchone()[0]
            status = "✅ Found" if exists else "❌ Missing"
            print(f"- {table}: {status}")
            
            if exists:
                cursor.execute(f"SELECT COUNT(*) FROM {table};")
                count = cursor.fetchone()[0]
                print(f"  (Rows: {count})")
        
        cursor.close()
        conn.close()
        print("\nValidation complete!")
        
    except Exception as e:
        print(f"\n❌ Database validation failed: {e}")
        print("\nTroubleshooting tips:")
        print("1. Is PostgreSQL running?")
        print("2. Are the credentials in .env correct?")
        print("3. Did you run setup_db.py yet?")
        sys.exit(1)

if __name__ == "__main__":
    validate_database()
