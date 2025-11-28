import feedparser
import requests
from urllib.parse import urljoin, urlparse
from datetime import datetime
from PIL import Image
from io import BytesIO
import os
import hashlib
import re
from typing import Optional, Dict, Any


UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
THUMBNAIL_WIDTH = int(os.getenv("THUMBNAIL_WIDTH", "600"))
THUMBNAIL_HEIGHT = int(os.getenv("THUMBNAIL_HEIGHT", "1200"))

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def is_valid_url(url: str) -> bool:
    """Check if URL is valid and uses http/https protocol"""
    try:
        result = urlparse(url)
        return result.scheme in ['http', 'https'] and bool(result.netloc)
    except:
        return False


def extract_image_from_html(html: str) -> Optional[str]:
    """Extract first image URL from HTML content"""
    if not html:
        return None
    
    img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
    match = re.search(img_pattern, html, re.IGNORECASE)
    return match.group(1) if match else None


def get_cover_image(entry: Dict[str, Any]) -> Optional[str]:
    """Extract cover image URL from RSS entry"""
    # 1. Check enclosures
    if hasattr(entry, 'enclosures') and entry.enclosures:
        for enclosure in entry.enclosures:
            if enclosure.get('type', '').startswith('image/'):
                url = enclosure.get('href') or enclosure.get('url')
                if url and is_valid_url(url):
                    return url
    
    # 2. Check media:content
    if hasattr(entry, 'media_content') and entry.media_content:
        for media in entry.media_content:
            url = media.get('url')
            if url and is_valid_url(url):
                return url
    
    # 3. Check media:thumbnail
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        url = entry.media_thumbnail[0].get('url') if isinstance(entry.media_thumbnail, list) else entry.media_thumbnail.get('url')
        if url and is_valid_url(url):
            return url
    
    # 4. Extract from content/description
    content = getattr(entry, 'content', [{}])[0].get('value', '') if hasattr(entry, 'content') else ''
    description = getattr(entry, 'summary', '')
    
    image_url = extract_image_from_html(content) or extract_image_from_html(description)
    if image_url and is_valid_url(image_url):
        return image_url
    
    return None


def download_and_process_image(image_url: str) -> Optional[str]:
    """Download image and create thumbnail"""
    try:
        if not is_valid_url(image_url):
            return None
        
        # Generate unique filename
        url_hash = hashlib.md5(image_url.encode()).hexdigest()
        filename = f"{url_hash}.webp"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Check if already exists
        if os.path.exists(filepath):
            return f"/uploads/{filename}"
        
        # Download image with headers to bypass anti-hotlinking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': urlparse(image_url).scheme + '://' + urlparse(image_url).netloc
        }
        
        response = requests.get(image_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Process image
        img = Image.open(BytesIO(response.content))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        
        # Resize
        img.thumbnail((THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT), Image.Resampling.LANCZOS)
        
        # Save as WebP
        img.save(filepath, 'WEBP', quality=80)
        
        return f"/uploads/{filename}"
    
    except Exception as e:
        print(f"Error processing image {image_url}: {e}")
        return None


def parse_rss_feed(feed_url: str) -> Dict[str, Any]:
    """Parse RSS feed and return feed info and entries"""
    feed = feedparser.parse(feed_url)
    
    if feed.bozo and not feed.entries:
        raise ValueError(f"Failed to parse RSS feed: {feed.get('bozo_exception', 'Unknown error')}")
    
    feed_info = {
        'title': feed.feed.get('title', 'Unknown Feed'),
        'site_url': feed.feed.get('link', ''),
        'description': feed.feed.get('description', ''),
    }
    
    entries = []
    for entry in feed.entries:
        # Parse published date
        published_at = None
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            published_at = datetime(*entry.published_parsed[:6])
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            published_at = datetime(*entry.updated_parsed[:6])
        else:
            published_at = datetime.utcnow()
        
        # Extract author
        author = None
        if hasattr(entry, 'author'):
            author = entry.author
        elif hasattr(entry, 'author_detail'):
            author = entry.author_detail.get('name')
        
        # Extract content
        content = ''
        if hasattr(entry, 'content'):
            content = entry.content[0].value if entry.content else ''
        elif hasattr(entry, 'summary'):
            content = entry.summary
        
        # Extract categories
        categories = []
        if hasattr(entry, 'tags'):
            categories = [tag.term for tag in entry.tags]
        
        entries.append({
            'title': entry.get('title', 'Untitled'),
            'link': entry.get('link', ''),
            'description': entry.get('summary', ''),
            'content': content,
            'author': author,
            'categories': categories,
            'published_at': published_at,
            'cover_image': get_cover_image(entry),
        })
    
    return {
        'feed_info': feed_info,
        'entries': entries,
    }
