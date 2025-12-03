import feedparser
import requests
from urllib.parse import urljoin, urlparse
from datetime import datetime, timedelta
from PIL import Image
from io import BytesIO
import os
import hashlib
import re
import time
import glob
from typing import Optional, Dict, Any


UPLOAD_DIR = os.path.join(os.getenv("DATA_DIR", "./data"), "uploads")
THUMBNAIL_WIDTH = int(os.getenv("THUMBNAIL_WIDTH", "600"))
THUMBNAIL_HEIGHT = int(os.getenv("THUMBNAIL_HEIGHT", "1200"))

# 缓存大小限制（单位：MB），默认 1GB，设置为 0 表示无限制
CACHE_SIZE_LIMIT_MB = int(os.getenv("CACHE_SIZE_LIMIT_MB", "1000"))

# RSS 请求配置
RSS_REQUEST_TIMEOUT = int(os.getenv("RSS_REQUEST_TIMEOUT", "60"))  # 默认 60 秒超时
RSS_MAX_RETRIES = int(os.getenv("RSS_MAX_RETRIES", "2"))  # 默认重试 2 次
RSS_RETRY_DELAY = int(os.getenv("RSS_RETRY_DELAY", "3"))  # 重试间隔 3 秒

# 模拟浏览器的请求头
BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
}

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_cache_size() -> int:
    """获取缓存目录的总大小（字节）"""
    total_size = 0
    for filepath in glob.glob(os.path.join(UPLOAD_DIR, "*")):
        if os.path.isfile(filepath):
            total_size += os.path.getsize(filepath)
    return total_size


def cleanup_old_cache(target_size_bytes: int):
    """
    清理旧缓存直到总大小低于目标值。
    按文件访问时间（atime）排序，优先删除最久未访问的文件。
    """
    if target_size_bytes <= 0:
        return
    
    # 获取所有缓存文件及其信息
    cache_files = []
    for filepath in glob.glob(os.path.join(UPLOAD_DIR, "*")):
        if os.path.isfile(filepath):
            try:
                stat = os.stat(filepath)
                cache_files.append({
                    'path': filepath,
                    'size': stat.st_size,
                    'atime': stat.st_atime,  # 最后访问时间
                })
            except OSError:
                continue
    
    # 按访问时间排序（最旧的在前）
    cache_files.sort(key=lambda x: x['atime'])
    
    current_size = sum(f['size'] for f in cache_files)
    deleted_count = 0
    deleted_size = 0
    
    # 删除文件直到低于目标大小的 90%（留出一些余量）
    target_after_cleanup = int(target_size_bytes * 0.9)
    
    for file_info in cache_files:
        if current_size <= target_after_cleanup:
            break
        try:
            os.remove(file_info['path'])
            current_size -= file_info['size']
            deleted_count += 1
            deleted_size += file_info['size']
        except OSError as e:
            print(f"Failed to delete cache file {file_info['path']}: {e}")
    
    if deleted_count > 0:
        print(f"Cache cleanup: deleted {deleted_count} files, freed {deleted_size / 1024 / 1024:.2f} MB")


def check_and_cleanup_cache():
    """检查缓存大小并在超限时清理"""
    if CACHE_SIZE_LIMIT_MB <= 0:
        return  # 无限制
    
    limit_bytes = CACHE_SIZE_LIMIT_MB * 1024 * 1024
    current_size = get_cache_size()
    
    if current_size > limit_bytes:
        print(f"Cache size ({current_size / 1024 / 1024:.2f} MB) exceeds limit ({CACHE_SIZE_LIMIT_MB} MB), cleaning up...")
        cleanup_old_cache(limit_bytes)


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
        
        # 检查并清理缓存
        check_and_cleanup_cache()
        
        return f"/uploads/{filename}"
    
    except Exception as e:
        print(f"Error processing image {image_url}: {e}")
        return None


def fetch_rss_content(feed_url: str) -> str:
    """
    Fetch RSS content with retry mechanism and longer timeout.
    Useful for services like RSSHub that may need time to generate content.
    """
    last_error = None
    
    for attempt in range(RSS_MAX_RETRIES + 1):
        try:
            if attempt > 0:
                print(f"Retry attempt {attempt} for {feed_url}")
                time.sleep(RSS_RETRY_DELAY)
            
            response = requests.get(
                feed_url,
                headers=BROWSER_HEADERS,
                timeout=RSS_REQUEST_TIMEOUT,
                allow_redirects=True
            )
            response.raise_for_status()
            
            # 检查是否返回了有效内容
            content = response.text
            if not content or len(content.strip()) < 50:
                raise ValueError("Empty or too short response")
            
            return content
            
        except requests.exceptions.Timeout as e:
            last_error = f"Request timeout after {RSS_REQUEST_TIMEOUT}s"
            print(f"Timeout fetching {feed_url}: {e}")
        except requests.exceptions.RequestException as e:
            last_error = str(e)
            print(f"Error fetching {feed_url}: {e}")
        except ValueError as e:
            last_error = str(e)
            print(f"Invalid response from {feed_url}: {e}")
    
    raise ValueError(f"Failed to fetch RSS after {RSS_MAX_RETRIES + 1} attempts: {last_error}")


def parse_rss_feed(feed_url: str) -> Dict[str, Any]:
    """Parse RSS feed and return feed info and entries"""
    # 使用自定义的获取函数，支持重试和更长超时
    try:
        content = fetch_rss_content(feed_url)
        feed = feedparser.parse(content)
    except ValueError:
        # 如果自定义获取失败，尝试 feedparser 直接获取（作为备用方案）
        feed = feedparser.parse(feed_url)
    
    if feed.bozo and not feed.entries:
        raise ValueError(f"Failed to parse RSS feed: {feed.get('bozo_exception', 'Unknown error')}")
    
    feed_info = {
        'title': feed.feed.get('title', 'Unknown Feed'),
        'site_url': feed.feed.get('link', ''),
        'description': feed.feed.get('description', ''),
    }
    
    entries = []
    for i, entry in enumerate(feed.entries):
        # Parse published date
        published_at = None
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            published_at = datetime(*entry.published_parsed[:6])
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            published_at = datetime(*entry.updated_parsed[:6])
        else:
            # For entries without pubDate, use current time plus (total - index) to preserve feed order
            # First entries get latest timestamps so they appear first in desc sort
            published_at = datetime.utcnow() + timedelta(seconds=len(feed.entries) - i)
        
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
