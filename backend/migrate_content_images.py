#!/usr/bin/env python3
"""Migration script to process images in existing feed item content"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db, FeedItem
from app.rss_parser import process_content_images

def migrate_content_images():
    """Process images in existing feed item content"""
    db = next(get_db())
    try:
        items = db.query(FeedItem).filter(FeedItem.content != None).all()
        print(f"Processing {len(items)} items...")
        
        updated = 0
        for item in items:
            try:
                processed_content = process_content_images(item.content)
                if processed_content != item.content:
                    item.content = processed_content
                    updated += 1
                    print(f"Updated item: {item.title}")
            except Exception as e:
                print(f"Error processing item {item.id}: {e}")
        
        db.commit()
        print(f"Successfully updated {updated} items")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_content_images()