"""
Migration script to add is_read and read_at fields to feed_items table
"""
import sys
from pathlib import Path

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, engine
from sqlalchemy import text


def migrate():
    """Add is_read and read_at columns to feed_items table"""
    db = SessionLocal()
    try:
        print("🔧 Adding is_read and read_at columns to feed_items table...")
        
        # Check if columns already exist
        result = db.execute(text("PRAGMA table_info(feed_items)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'is_read' not in columns:
            db.execute(text("ALTER TABLE feed_items ADD COLUMN is_read BOOLEAN DEFAULT 0"))
            print("✅ Added is_read column")
        else:
            print("⏭️  is_read column already exists")
        
        if 'read_at' not in columns:
            db.execute(text("ALTER TABLE feed_items ADD COLUMN read_at DATETIME"))
            print("✅ Added read_at column")
        else:
            print("⏭️  read_at column already exists")
        
        db.commit()
        print("\n✨ Migration complete!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Starting migration...\n")
    migrate()
