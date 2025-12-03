"""
Migration script to add last_fetch_error column to feeds table.
Run this script to update existing database.
"""
import sqlite3
import os

DATA_DIR = os.getenv("DATA_DIR", "./data")
DB_PATH = os.path.join(DATA_DIR, "rss_wall.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}, skipping migration.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if column already exists
    cursor.execute("PRAGMA table_info(feeds)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'last_fetch_error' not in columns:
        print("Adding 'last_fetch_error' column to feeds table...")
        cursor.execute("ALTER TABLE feeds ADD COLUMN last_fetch_error TEXT")
        conn.commit()
        print("Migration completed successfully!")
    else:
        print("Column 'last_fetch_error' already exists, skipping.")
    
    conn.close()

if __name__ == "__main__":
    migrate()
