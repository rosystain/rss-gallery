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

from app.database import get_db, init_db, Feed, FeedItem, FeedReadStatus, Integration, PresetIntegration
from app.schemas import FeedCreate, FeedUpdate, FeedResponse, FeedItemResponse, FeedBriefResponse, ItemsListResponse, IntegrationCreate, IntegrationUpdate, IntegrationResponse, PresetIntegrationUpdate, PresetIntegrationResponse
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

# 条目清理配置：每个 Feed 最多保留的条目数，默认 1000 条，设为 0 表示不限制
MAX_ITEMS_PER_FEED = int(os.getenv("MAX_ITEMS_PER_FEED", "1000"))


# Initialize database
@app.on_event("startup")
def startup_event():
    # Run Alembic migrations
    try:
        from alembic.config import Config
        from alembic import command
        import os
        
        # Get the backend directory path
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        
        print("Running database migrations...")
        command.upgrade(alembic_cfg, "head")
        print("Database migrations completed successfully")
    except Exception as e:
        print(f"Warning: Database migration failed: {e}")
        print("Falling back to basic table creation...")
        init_db()
    
    # Fetch feeds on startup
    scheduler = BackgroundScheduler()
    scheduler.add_job(fetch_all_feeds, 'interval', minutes=int(os.getenv("FETCH_INTERVAL_MINUTES", "30")))
    scheduler.start()
    
    # Initial fetch after 2 seconds (wrapped in try-except to prevent startup blocking)
    def safe_initial_fetch():
        try:
            fetch_all_feeds()
        except Exception as e:
            print(f"Error during initial feed fetch (non-blocking): {e}")
    
    import threading
    threading.Timer(2.0, safe_initial_fetch).start()


def cleanup_old_items(db: Session, feed_id: str):
    """
    清理指定 Feed 的旧条目，只保留最新的 MAX_ITEMS_PER_FEED 条。
    采用消极策略：只在超过限制的 120% 时才清理，避免频繁操作。
    """
    if MAX_ITEMS_PER_FEED <= 0:
        return  # 不限制
    
    item_count = db.query(FeedItem).filter(FeedItem.feed_id == feed_id).count()
    
    # 只有超过限制的 120% 才触发清理（消极策略）
    threshold = int(MAX_ITEMS_PER_FEED * 1.2)
    if item_count <= threshold:
        return
    
    # 获取需要删除的条目（最旧的）
    items_to_delete = item_count - MAX_ITEMS_PER_FEED
    old_items = db.query(FeedItem).filter(
        FeedItem.feed_id == feed_id
    ).order_by(
        FeedItem.published_at.asc()
    ).limit(items_to_delete).all()
    
    if old_items:
        deleted_ids = [item.id for item in old_items]
        db.query(FeedItem).filter(FeedItem.id.in_(deleted_ids)).delete(synchronize_session=False)
        db.commit()
        print(f"Cleaned up {len(deleted_ids)} old items from feed {feed_id}")


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


def retry_failed_images(db: Session, feed_id: str, max_retries: int = 5):
    """
    重试下载之前失败的图片。
    只处理有 cover_image 但没有 thumbnail_image 的条目。
    每次最多重试 max_retries 个，避免阻塞太久。
    """
    failed_items = db.query(FeedItem).filter(
        FeedItem.feed_id == feed_id,
        FeedItem.cover_image != None,
        FeedItem.thumbnail_image == None
    ).limit(max_retries).all()
    
    if not failed_items:
        return
    
    retried = 0
    success = 0
    for item in failed_items:
        try:
            thumbnail_path = download_and_process_image(item.cover_image)
            if thumbnail_path:
                item.thumbnail_image = thumbnail_path
                success += 1
            retried += 1
        except Exception as e:
            print(f"Retry failed for item {item.id}: {e}")
            retried += 1
    
    if retried > 0:
        db.commit()
        print(f"Retried {retried} failed images, {success} succeeded for feed {feed_id}")


def fetch_all_feeds():
    """Background task to fetch all active feeds"""
    try:
        db = next(get_db())
    except Exception as e:
        print(f"Failed to get database connection for feed fetching: {e}")
        return
    
    try:
        feeds = db.query(Feed).filter(Feed.is_active == True).all()
        print(f"Fetching {len(feeds)} feeds...")
        
        for feed in feeds:
            try:
                print(f"Fetching feed: {feed.title}")
                result = parse_rss_feed(feed.url)
                
                new_items = 0
                for entry_data in result['entries']:
                    # Check if item already exists (优先使用 guid,后备使用 link)
                    existing = None
                    if entry_data.get('guid'):
                        existing = db.query(FeedItem).filter(FeedItem.guid == entry_data['guid']).first()
                    if not existing and entry_data.get('link'):
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
                        guid=entry_data.get('guid'),
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
                
                # Update feed's last_fetched_at and clear error
                feed.last_fetched_at = datetime.utcnow()
                feed.last_fetch_error = None  # 清除错误状态
                db.commit()
                
                print(f"Added {new_items} new items from {feed.title}")
                
                # 重试之前失败的图片（每次最多 5 个）
                retry_failed_images(db, feed.id)
                
                # 清理旧条目（消极策略，超过 120% 才清理）
                cleanup_old_items(db, feed.id)
                
            except Exception as e:
                error_msg = str(e)
                print(f"Error fetching feed {feed.title}: {error_msg}")
                db.rollback()
                # 记录错误状态
                try:
                    feed.last_fetch_error = error_msg[:500]  # 限制错误信息长度
                    feed.last_fetched_at = datetime.utcnow()
                    db.commit()
                except:
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
    import json
    feeds = db.query(Feed).order_by(Feed.created_at.desc()).all()
    
    result = []
    for feed in feeds:
        items_count = db.query(FeedItem).filter(FeedItem.feed_id == feed.id).count()
        
        # Calculate unread count using is_read field
        unread_count = db.query(FeedItem).filter(
            FeedItem.feed_id == feed.id,
            FeedItem.is_read == False
        ).count()
        
        # Parse enabled_integrations from JSON
        enabled_integrations = None
        if feed.enabled_integrations:
            try:
                enabled_integrations = json.loads(feed.enabled_integrations)
            except:
                enabled_integrations = None
        
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
            "last_fetch_error": feed.last_fetch_error,
            "is_active": feed.is_active,
            "created_at": feed.created_at,
            "items_count": items_count,
            "unread_count": unread_count,
            "enabled_integrations": enabled_integrations,
        }
        result.append(FeedResponse(**feed_dict))
    
    return result


@app.post("/api/feeds", response_model=FeedResponse)
def create_feed(feed_data: FeedCreate, db: Session = Depends(get_db)):
    """Create a new feed and parse its content"""
    from urllib.parse import urlparse
    
    # Check if feed already exists
    existing = db.query(Feed).filter(Feed.url == feed_data.url).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feed URL already exists")
    
    warning_message = None
    fetch_error = None  # 用于记录到数据库的错误信息
    feed_info = None
    entries = []
    
    # Try to parse RSS feed
    try:
        result = parse_rss_feed(feed_data.url)
        feed_info = result['feed_info']
        entries = result['entries']
    except Exception as e:
        # RSS 解析失败，但仍然创建订阅
        error_str = str(e)
        fetch_error = error_str[:500]  # 限制错误信息长度
        warning_message = f"订阅已添加，但获取内容时出现问题: {error_str}。系统将在后续自动重试获取内容。"
        print(f"Warning: Failed to parse RSS feed {feed_data.url}: {e}")
        
        # 使用 URL 生成默认信息
        parsed_url = urlparse(feed_data.url)
        feed_info = {
            'title': parsed_url.netloc or feed_data.url,
            'site_url': f"{parsed_url.scheme}://{parsed_url.netloc}" if parsed_url.netloc else None,
            'description': None,
        }
    
    try:
        # Fetch favicon
        favicon_url = None
        if feed_info.get('site_url'):
            try:
                favicon_url = get_favicon_url(feed_info['site_url'])
            except Exception as e:
                print(f"Warning: Failed to fetch favicon: {e}")
        
        # Serialize enabled_integrations if provided
        enabled_integrations_json = None
        if feed_data.enabled_integrations is not None:
            import json
            enabled_integrations_json = json.dumps(feed_data.enabled_integrations)
        
        # Create feed
        feed = Feed(
            id=str(uuid.uuid4()),
            title=feed_info['title'],
            url=feed_data.url,
            site_url=feed_info.get('site_url'),
            description=feed_info.get('description'),
            favicon=favicon_url,
            category=feed_data.category,
            last_fetch_error=fetch_error,  # 记录首次抓取的错误状态
            enabled_integrations=enabled_integrations_json,
        )
        db.add(feed)
        db.commit()
        db.refresh(feed)
        
        # Parse and store entries (without processing images)
        for entry_data in entries:
            item = FeedItem(
                id=str(uuid.uuid4()),
                feed_id=feed.id,
                title=entry_data['title'],
                guid=entry_data.get('guid'),
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
        
        # Process images in background (only if we have entries)
        if entries:
            import threading
            threading.Thread(target=process_feed_images, args=(feed.id,)).start()
        
        # Parse enabled_integrations for response
        response_enabled_integrations = None
        if feed.enabled_integrations:
            try:
                response_enabled_integrations = json.loads(feed.enabled_integrations)
            except:
                response_enabled_integrations = None
        
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
            last_fetch_error=feed.last_fetch_error,  # 返回错误状态
            is_active=feed.is_active,
            created_at=feed.created_at,
            items_count=len(entries),
            warning=warning_message,
            enabled_integrations=response_enabled_integrations,
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


@app.post("/api/items/{item_id}/favorite")
def toggle_item_favorite(
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    Toggle favorite status for an item.
    """
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Toggle favorite status
    item.is_favorite = not item.is_favorite
    if item.is_favorite:
        item.favorited_at = datetime.utcnow()
    else:
        item.favorited_at = None
    
    db.commit()
    
    return {"success": True, "is_favorite": item.is_favorite}


@app.get("/api/items/favorites", response_model=ItemsListResponse)
def get_favorite_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query('published', regex='^(published|created|favorited)$'),
    db: Session = Depends(get_db)
):
    """Get all favorite items with pagination"""
    query = db.query(FeedItem).filter(FeedItem.is_favorite == True)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    if sort_by == 'created':
        query = query.order_by(FeedItem.created_at.desc())
    elif sort_by == 'favorited':
        query = query.order_by(FeedItem.favorited_at.desc())
    else:  # default to published
        query = query.order_by(FeedItem.published_at.desc())
    
    # Apply pagination
    skip = (page - 1) * limit
    items = query.offset(skip).limit(limit).all()
    
    # Convert to response format
    result_items = []
    for item in items:
        is_unread = not item.is_read
        
        # Parse feed's enabled_integrations
        feed_enabled_integrations = None
        if item.feed and item.feed.enabled_integrations:
            try:
                feed_enabled_integrations = json.loads(item.feed.enabled_integrations)
            except:
                feed_enabled_integrations = None
        
        # Create FeedBriefResponse for proper camelCase conversion
        feed_brief = None
        if item.feed:
            feed_brief = FeedBriefResponse(
                title=item.feed.title,
                category=item.feed.category,
                favicon=item.feed.favicon,
                enabled_integrations=feed_enabled_integrations,
            )
        
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
            "is_favorite": item.is_favorite,
            "feed": feed_brief,
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
        
        # Update enabled_integrations if provided
        if feed_data.enabled_integrations is not None:
            import json
            feed.enabled_integrations = json.dumps(feed_data.enabled_integrations)
        
        db.commit()
        db.refresh(feed)
        
        items_count = db.query(FeedItem).filter(FeedItem.feed_id == feed.id).count()
        
        # Parse enabled_integrations from JSON
        import json
        enabled_integrations = None
        if feed.enabled_integrations:
            try:
                enabled_integrations = json.loads(feed.enabled_integrations)
            except:
                enabled_integrations = None
        
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
            enabled_integrations=enabled_integrations,
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
            # Check if item already exists (优先使用 guid,后备使用 link)
            existing = None
            if entry_data.get('guid'):
                existing = db.query(FeedItem).filter(FeedItem.guid == entry_data['guid']).first()
            if not existing and entry_data.get('link'):
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
                guid=entry_data.get('guid'),
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
        feed.last_fetch_error = None  # 清除错误状态
        db.commit()
        
        return {"success": True, "newItems": new_items}
        
    except Exception as e:
        error_msg = str(e)
        # 记录错误状态
        feed.last_fetch_error = error_msg[:500]
        feed.last_fetched_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to fetch feed: {error_msg}")


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
        
        # Parse feed's enabled_integrations
        feed_enabled_integrations = None
        if item.feed and item.feed.enabled_integrations:
            try:
                feed_enabled_integrations = json.loads(item.feed.enabled_integrations)
            except:
                feed_enabled_integrations = None
        
        # Create FeedBriefResponse for proper camelCase conversion
        feed_brief = None
        if item.feed:
            feed_brief = FeedBriefResponse(
                title=item.feed.title,
                category=item.feed.category,
                favicon=item.feed.favicon,
                enabled_integrations=feed_enabled_integrations,
            )
        
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
            "is_favorite": item.is_favorite,
            "feed": feed_brief,
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


@app.post("/api/items/{item_id}/refresh-image")
def refresh_item_image(item_id: str, db: Session = Depends(get_db)):
    """
    尝试重新下载并处理条目的封面图片。
    用于修复之前下载失败的图片。
    """
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if not item.cover_image:
        raise HTTPException(status_code=400, detail="No cover image URL available")
    
    try:
        thumbnail_path = download_and_process_image(item.cover_image)
        if thumbnail_path:
            item.thumbnail_image = thumbnail_path
            db.commit()
            return {"success": True, "thumbnail_image": thumbnail_path}
        else:
            raise HTTPException(status_code=400, detail="Failed to process image")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to refresh image: {str(e)}")


# ==================== 集成 API ====================

@app.get("/api/integrations", response_model=list[IntegrationResponse])
def get_integrations(db: Session = Depends(get_db)):
    """获取所有集成配置"""
    integrations = db.query(Integration).order_by(Integration.sort_order, Integration.created_at).all()
    return integrations


@app.post("/api/integrations", response_model=IntegrationResponse)
def create_integration(integration: IntegrationCreate, db: Session = Depends(get_db)):
    """创建新的集成"""
    db_integration = Integration(
        id=f"int_{uuid.uuid4().hex[:12]}",
        name=integration.name,
        type=integration.type,
        icon=integration.icon,
        url=integration.url,
        webhook_url=integration.webhook_url,
        webhook_method=integration.webhook_method,
        webhook_body=integration.webhook_body,
        sort_order=integration.sort_order or 0,
    )
    db.add(db_integration)
    db.commit()
    db.refresh(db_integration)
    return db_integration


@app.get("/api/integrations/{integration_id}", response_model=IntegrationResponse)
def get_integration(integration_id: str, db: Session = Depends(get_db)):
    """获取单个集成配置"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@app.put("/api/integrations/{integration_id}", response_model=IntegrationResponse)
def update_integration(integration_id: str, integration: IntegrationUpdate, db: Session = Depends(get_db)):
    """更新集成配置"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    update_data = integration.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_integration, key, value)
    
    db.commit()
    db.refresh(db_integration)
    return db_integration


@app.delete("/api/integrations/{integration_id}")
def delete_integration(integration_id: str, db: Session = Depends(get_db)):
    """删除集成配置"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    db.delete(db_integration)
    db.commit()
    return {"success": True}


# ========== 预设集成 API ==========

@app.get("/api/preset-integrations", response_model=list[PresetIntegrationResponse])
def get_preset_integrations(db: Session = Depends(get_db)):
    """获取所有预设集成配置"""
    presets = db.query(PresetIntegration).all()
    
    # 将 config JSON 字符串解析为 dict
    result = []
    for preset in presets:
        preset_dict = {
            "id": preset.id,
            "enabled": preset.enabled,
            "api_url": preset.api_url,
            "config": json.loads(preset.config) if preset.config else None,
            "default_favcat": preset.default_favcat,
            "default_note": preset.default_note,
            "created_at": preset.created_at,
            "updated_at": preset.updated_at,
        }
        result.append(preset_dict)
    
    return result


@app.get("/api/preset-integrations/{preset_id}", response_model=PresetIntegrationResponse)
def get_preset_integration(preset_id: str, db: Session = Depends(get_db)):
    """获取指定预设集成配置"""
    preset = db.query(PresetIntegration).filter(PresetIntegration.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset integration not found")
    
    return {
        "id": preset.id,
        "enabled": preset.enabled,
        "api_url": preset.api_url,
        "config": json.loads(preset.config) if preset.config else None,
        "default_favcat": preset.default_favcat,
        "default_note": preset.default_note,
        "created_at": preset.created_at,
        "updated_at": preset.updated_at,
    }


@app.put("/api/preset-integrations/{preset_id}", response_model=PresetIntegrationResponse)
def update_preset_integration(preset_id: str, update: PresetIntegrationUpdate, db: Session = Depends(get_db)):
    """更新预设集成配置（不存在则创建）"""
    preset = db.query(PresetIntegration).filter(PresetIntegration.id == preset_id).first()
    
    if not preset:
        # 不存在则创建
        preset = PresetIntegration(
            id=preset_id,
            enabled=update.enabled if update.enabled is not None else False,
            api_url=update.api_url,
            config=json.dumps(update.config) if update.config else None,
            default_favcat=update.default_favcat,
            default_note=update.default_note,
        )
        db.add(preset)
    else:
        # 存在则更新
        if update.enabled is not None:
            preset.enabled = update.enabled
        if update.api_url is not None:
            preset.api_url = update.api_url
        if update.config is not None:
            preset.config = json.dumps(update.config)
        if update.default_favcat is not None:
            preset.default_favcat = update.default_favcat
        if update.default_note is not None:
            preset.default_note = update.default_note
        preset.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(preset)
    
    return {
        "id": preset.id,
        "enabled": preset.enabled,
        "api_url": preset.api_url,
        "config": json.loads(preset.config) if preset.config else None,
        "default_favcat": preset.default_favcat,
        "default_note": preset.default_note,
        "created_at": preset.created_at,
        "updated_at": preset.updated_at,
    }


# Serve frontend static files (only in production/Docker)
if os.path.exists("/app/frontend/dist"):
    app.mount("/", StaticFiles(directory="/app/frontend/dist", html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
