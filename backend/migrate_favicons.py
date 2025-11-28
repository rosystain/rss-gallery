"""
Migration script to fetch favicons for existing feeds
"""
import sys
from pathlib import Path

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, Feed
from app.favicon_fetcher import get_favicon_url


def migrate_favicons():
    """Fetch and update favicons for all feeds that don't have one"""
    db = SessionLocal()
    try:
        # Get all feeds
        feeds = db.query(Feed).all()
        
        updated_count = 0
        skipped_count = 0
        
        for feed in feeds:
            # Skip if already has favicon
            if feed.favicon:
                print(f"⏭️  Skipping '{feed.title}' - already has favicon")
                skipped_count += 1
                continue
            
            # Skip if no site_url
            if not feed.site_url:
                print(f"⚠️  Skipping '{feed.title}' - no site URL")
                skipped_count += 1
                continue
            
            print(f"🔍 Fetching favicon for '{feed.title}' from {feed.site_url}...")
            
            # Fetch favicon
            favicon_url = get_favicon_url(feed.site_url)
            
            if favicon_url:
                feed.favicon = favicon_url
                db.commit()
                print(f"✅ Updated '{feed.title}' with favicon")
                updated_count += 1
            else:
                print(f"❌ Failed to fetch favicon for '{feed.title}'")
                skipped_count += 1
        
        print(f"\n📊 Summary:")
        print(f"   Updated: {updated_count}")
        print(f"   Skipped: {skipped_count}")
        print(f"   Total: {len(feeds)}")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Starting favicon migration...\n")
    migrate_favicons()
    print("\n✨ Migration complete!")
