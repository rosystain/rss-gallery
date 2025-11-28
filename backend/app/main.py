from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from typing import Optional
import uuid
import json
import os
from datetime import datetime

from app.database import get_db, init_db, Feed, FeedItem, FeedReadStatus
from app.schemas import FeedCreate, FeedUpdate, FeedResponse, FeedItemResponse, ItemsListResponse
from app.rss_parser import parse_rss_feed, download_and_process_image
from app.favicon_fetcher import get_favicon_url

app = FastAPI(title="RSS Image Wall API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
DATA_DIR = os.getenv("DATA_DIR", "./data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# Initialize database
@app.on_event("startup")
def startup_event():
    init_db()
    # Fetch feeds on startup
    scheduler = BackgroundScheduler()
    scheduler.add_job(fetch_all_feeds, 'interval', minutes=int(os.getenv("FETCH_INTERVAL_MINUTES", "30")))
    scheduler.start()
    
    # Initial fetch after 2 seconds
    import threading
    threading.Timer(2.0, fetch_all_feeds).start()


def process_feed_images(feed_id: str):
    """Background task to process images for a feed"""
    db = next(get_db())
    try:
        items = db.query(FeedItem).filter(
            FeedItem.feed_id == feed_id,
            FeedItem.thumbnail_image == None,
            FeedItem.cover_image != None
        ).all()
        
        for item in items:
            try:
                thumbnail_path = download_and_process_image(item.cover_image)
                if thumbnail_path:
                    item.thumbnail_image = thumbnail_path
                    db.commit()
            except Exception as e:
                print(f"Error processing image for item {item.id}: {e}")
                db.rollback()
    finally:
        db.close()


def fetch_all_feeds():
    """Background task to fetch all active feeds"""
    db = next(get_db())
    try:
        feeds = db.query(Feed).filter(Feed.is_active == True).all()
        print(f"Fetching {len(feeds)} feeds...")
        
        for feed in feeds:
            try:
                print(f"Fetching feed: {feed.title}")
                result = parse_rss_feed(feed.url)
                
                new_items = 0
                for entry_data in result['entries']:
                    # Check if item already exists
                    existing = db.query(FeedItem).filter(FeedItem.link == entry_data['link']).first()
                    if existing:
                        continue
                    
                    # Download and process image
                    thumbnail_path = None
                    if entry_data.get('cover_image'):
                        thumbnail_path = download_and_process_image(entry_data['cover_image'])
                    
                    # Create new item
                    item = FeedItem(
                        id=str(uuid.uuid4()),
                        feed_id=feed.id,
                        title=entry_data['title'],
                        link=entry_data['link'],
                        description=entry_data.get('description'),
                        content=entry_data.get('content'),
                        cover_image=entry_data.get('cover_image'),
                        thumbnail_image=thumbnail_path,
                        author=entry_data.get('author'),
                        categories=json.dumps(entry_data.get('categories', [])),
                        published_at=entry_data['published_at'],
                    )
                    db.add(item)
                    new_items += 1
                
                # Update feed's last_fetched_at
                feed.last_fetched_at = datetime.utcnow()
                db.commit()
                
                print(f"Added {new_items} new items from {feed.title}")
                
            except Exception as e:
                print(f"Error fetching feed {feed.title}: {e}")
                db.rollback()
    finally:
        db.close()


# API Routes

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/feeds", response_model=list[FeedResponse])
def get_feeds(db: Session = Depends(get_db)):
    """Get all feeds with item counts and unread counts"""
    feeds = db.query(Feed).order_by(Feed.created_at.desc()).all()
    
    result = []
    for feed in feeds:
        items_count = db.query(FeedItem).filter(FeedItem.feed_id == feed.id).count()
        
        # Calculate unread count using is_read field
        unread_count = db.query(FeedItem).filter(
            FeedItem.feed_id == feed.id,
            FeedItem.is_read == False
        ).count()
        
        feed_dict = {
            "id": feed.id,
            "title": feed.title,
            "url": feed.url,
            "site_url": feed.site_url,
            "description": feed.description,
            "favicon": feed.favicon,
            "category": feed.category,
            "update_interval": feed.update_interval,
            "last_fetched_at": feed.last_fetched_at,
            "is_active": feed.is_active,
            "created_at": feed.created_at,
            "items_count": items_count,
            "unread_count": unread_count,
        }
        result.append(FeedResponse(**feed_dict))
    
    return result


@app.post("/api/feeds", response_model=FeedResponse)
def create_feed(feed_data: FeedCreate, db: Session = Depends(get_db)):
    """Create a new feed and parse its content"""
    # Check if feed already exists
    existing = db.query(Feed).filter(Feed.url == feed_data.url).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feed URL already exists")
    
    try:
        # Parse RSS feed
        result = parse_rss_feed(feed_data.url)
        feed_info = result['feed_info']
        
        # Fetch favicon
        favicon_url = None
        if feed_info.get('site_url'):
            favicon_url = get_favicon_url(feed_info['site_url'])
        
        # Create feed
        feed = Feed(
            id=str(uuid.uuid4()),
            title=feed_info['title'],
            url=feed_data.url,
            site_url=feed_info.get('site_url'),
            description=feed_info.get('description'),
            favicon=favicon_url,
            category=feed_data.category,
        )
        db.add(feed)
        db.commit()
        db.refresh(feed)
        
        # Parse and store entries (without processing images)
        for entry_data in result['entries']:
            item = FeedItem(
                id=str(uuid.uuid4()),
                feed_id=feed.id,
                title=entry_data['title'],
                link=entry_data['link'],
                description=entry_data.get('description'),
                content=entry_data.get('content'),
                cover_image=entry_data.get('cover_image'),
                thumbnail_image=None,  # Will be processed in background
                author=entry_data.get('author'),
                categories=json.dumps(entry_data.get('categories', [])),
                published_at=entry_data['published_at'],
            )
            db.add(item)
        
        db.commit()
        
        # Process images in background
        import threading
        threading.Thread(target=process_feed_images, args=(feed.id,)).start()
        
        return FeedResponse(
            id=feed.id,
            title=feed.title,
            url=feed.url,
            site_url=feed.site_url,
            description=feed.description,
            favicon=feed.favicon,
            category=feed.category,
            update_interval=feed.update_interval,
            last_fetched_at=feed.last_fetched_at,
            is_active=feed.is_active,
            created_at=feed.created_at,
            items_count=len(result['entries']),
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create feed: {str(e)}")


@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: str, db: Session = Depends(get_db)):
    """Delete a feed and its items"""
    feed = db.query(Feed).filter(Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    db.delete(feed)
    db.commit()
    return {"success": True}


@app.post("/api/items/mark-read")
def mark_items_as_read(
    item_ids: list[str],
    db: Session = Depends(get_db)
):
    """
    Mark specific items as read by their IDs.
    """
    if not item_ids:
        raise HTTPException(status_code=400, detail="No item IDs provided")
    
    # Update items
    updated = db.query(FeedItem).filter(FeedItem.id.in_(item_ids)).update(
        {"is_read": True, "read_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()
    
    return {"success": True, "marked_count": updated}


@app.post("/api/items/{item_id}/mark-read")
def mark_single_item_as_read(
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark a single item as read.
    """
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.is_read = True
    item.read_at = datetime.utcnow()
    db.commit()
    
    return {"success": True}


@app.post("/api/feeds/{feed_id}/mark-all-read")
def mark_all_feed_items_as_read(
    feed_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark all items in a feed as read.
    """
    feed = db.query(Feed).filter(Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    updated = db.query(FeedItem).filter(
        FeedItem.feed_id == feed_id,
        FeedItem.is_read == False
    ).update(
        {"is_read": True, "read_at": datetime.utcnow()},
        synchronize_session=False
    )
    db.commit()
    
    return {"success": True, "marked_count": updated}


@app.post("/api/feeds/{feed_id}/mark-read")
def mark_feed_as_read(
    feed_id: str, 
    latest_item_time: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Mark items as read up to a certain time.
    If latest_item_time is provided, mark all items published up to that time as read.
    Otherwise, mark all current items as read.
    """
    feed = db.query(Feed).filter(Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    # Determine the last viewed time
    if latest_item_time:
        last_viewed = datetime.fromisoformat(latest_item_time.replace('Z', '+00:00'))
        # Convert to naive datetime (remove timezone info) to match database format
        last_viewed = last_viewed.replace(tzinfo=None)
    else:
        # Get the most recent item's published time
        latest_item = db.query(FeedItem).filter(
            FeedItem.feed_id == feed_id
        ).order_by(FeedItem.published_at.desc()).first()
        
        if latest_item:
            last_viewed = latest_item.published_at
        else:
            last_viewed = datetime.utcnow()
    
    # Check if read status exists
    read_status = db.query(FeedReadStatus).filter(FeedReadStatus.feed_id == feed_id).first()
    
    if read_status:
        # Update existing record (only if new time is later)
        if last_viewed > read_status.last_viewed_at:
            read_status.last_viewed_at = last_viewed
            read_status.updated_at = datetime.utcnow()
    else:
        # Create new record
        read_status = FeedReadStatus(
            id=str(uuid.uuid4()),
            feed_id=feed_id,
            last_viewed_at=last_viewed
        )
        db.add(read_status)
    
    db.commit()
    return {"success": True, "last_viewed_at": read_status.last_viewed_at}


@app.put("/api/feeds/{feed_id}", response_model=FeedResponse)
def update_feed(feed_id: str, feed_data: FeedUpdate, db: Session = Depends(get_db)):
    """Update a feed's URL or category"""
    feed = db.query(Feed).filter(Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    try:
        # If URL is being updated, parse the new feed
        if feed_data.url and feed_data.url != feed.url:
            result = parse_rss_feed(feed_data.url)
            feed_info = result['feed_info']
            
            feed.url = feed_data.url
            # Only auto-update title if not manually provided
            if feed_data.title is None:
                feed.title = feed_info['title']
            feed.site_url = feed_info.get('site_url')
            feed.description = feed_info.get('description')
            
            # Fetch new favicon
            if feed_info.get('site_url'):
                feed.favicon = get_favicon_url(feed_info['site_url'])
        
        # Update title if provided
        if feed_data.title is not None:
            feed.title = feed_data.title
        
        # Update category if provided
        if feed_data.category is not None:
            feed.category = feed_data.category
        
        db.commit()
        db.refresh(feed)
        
        items_count = db.query(FeedItem).filter(FeedItem.feed_id == feed.id).count()
        
        return FeedResponse(
            id=feed.id,
            title=feed.title,
            url=feed.url,
            site_url=feed.site_url,
            description=feed.description,
            favicon=feed.favicon,
            category=feed.category,
            update_interval=feed.update_interval,
            last_fetched_at=feed.last_fetched_at,
            is_active=feed.is_active,
            created_at=feed.created_at,
            items_count=items_count,
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update feed: {str(e)}")


@app.post("/api/feeds/{feed_id}/fetch")
def fetch_feed(feed_id: str, db: Session = Depends(get_db)):
    """Manually trigger feed fetch"""
    feed = db.query(Feed).filter(Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    try:
        result = parse_rss_feed(feed.url)
        new_items = 0
        
        for entry_data in result['entries']:
            existing = db.query(FeedItem).filter(FeedItem.link == entry_data['link']).first()
            if existing:
                continue
            
            thumbnail_path = None
            if entry_data.get('cover_image'):
                thumbnail_path = download_and_process_image(entry_data['cover_image'])
            
            item = FeedItem(
                id=str(uuid.uuid4()),
                feed_id=feed.id,
                title=entry_data['title'],
                link=entry_data['link'],
                description=entry_data.get('description'),
                content=entry_data.get('content'),
                cover_image=entry_data.get('cover_image'),
                thumbnail_image=thumbnail_path,
                author=entry_data.get('author'),
                categories=json.dumps(entry_data.get('categories', [])),
                published_at=entry_data['published_at'],
            )
            db.add(item)
            new_items += 1
        
        feed.last_fetched_at = datetime.utcnow()
        db.commit()
        
        return {"success": True, "newItems": new_items}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to fetch feed: {str(e)}")


@app.get("/api/items", response_model=ItemsListResponse)
def get_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    feed_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    unread_only: bool = False,
    sort_by: str = Query('published', regex='^(published|created)$'),
    db: Session = Depends(get_db)
):
    """Get feed items with pagination and filters"""
    query = db.query(FeedItem)
    
    # Apply filters
    if feed_id:
        query = query.filter(FeedItem.feed_id == feed_id)
    
    if category:
        feeds_in_category = db.query(Feed).filter(Feed.category == category).all()
        feed_ids = [f.id for f in feeds_in_category]
        query = query.filter(FeedItem.feed_id.in_(feed_ids))
    
    if search:
        query = query.filter(
            (FeedItem.title.contains(search)) | (FeedItem.description.contains(search))
        )
    
    # Apply unread filter
    if unread_only:
        query = query.filter(FeedItem.is_read == False)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    if sort_by == 'created':
        query = query.order_by(FeedItem.created_at.desc())
    else:  # default to published
        query = query.order_by(FeedItem.published_at.desc())
    
    # Apply pagination
    skip = (page - 1) * limit
    items = query.offset(skip).limit(limit).all()
    
    # Convert to response format
    result_items = []
    for item in items:
        # Use is_read field directly (support both all view and single feed view)
        is_unread = not item.is_read
        
        item_dict = {
            "id": item.id,
            "feed_id": item.feed_id,
            "title": item.title,
            "link": item.link,
            "description": item.description,
            "content": item.content,
            "cover_image": item.cover_image,
            "thumbnail_image": item.thumbnail_image,
            "author": item.author,
            "categories": item.categories,
            "published_at": item.published_at,
            "created_at": item.created_at,
            "is_unread": is_unread,
            "feed": {
                "title": item.feed.title,
                "category": item.feed.category,
                "favicon": item.feed.favicon,
            } if item.feed else None,
        }
        result_items.append(FeedItemResponse(**item_dict))
    
    has_more = skip + len(items) < total
    
    return ItemsListResponse(
        items=result_items,
        total=total,
        page=page,
        limit=limit,
        has_more=has_more,
    )


@app.get("/api/items/{item_id}", response_model=FeedItemResponse)
def get_item(item_id: str, db: Session = Depends(get_db)):
    """Get a single item by ID"""
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return FeedItemResponse(
        id=item.id,
        feed_id=item.feed_id,
        title=item.title,
        link=item.link,
        description=item.description,
        content=item.content,
        cover_image=item.cover_image,
        thumbnail_image=item.thumbnail_image,
        author=item.author,
        categories=item.categories,
        published_at=item.published_at,
        created_at=item.created_at,
        feed={
            "title": item.feed.title,
            "category": item.feed.category,
        } if item.feed else None,
    )


# Serve frontend static files
app.mount("/", StaticFiles(directory="/app/frontend/dist", html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
