from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FeedBase(BaseModel):
    url: str
    category: Optional[str] = None


class FeedCreate(FeedBase):
    pass


class FeedUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None


class FeedItemResponse(BaseModel):
    id: str
    feed_id: str
    title: str
    link: str
    description: Optional[str]
    content: Optional[str]
    cover_image: Optional[str]
    thumbnail_image: Optional[str]
    author: Optional[str]
    categories: Optional[str]
    published_at: datetime
    created_at: datetime
    feed: Optional[dict] = None
    is_unread: Optional[bool] = None

    class Config:
        from_attributes = True
        populate_by_name = True
        
        # Convert snake_case to camelCase for JSON
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )


class FeedResponse(BaseModel):
    id: str
    title: str
    url: str
    site_url: Optional[str]
    description: Optional[str]
    favicon: Optional[str]
    category: Optional[str]
    update_interval: int
    last_fetched_at: Optional[datetime]
    last_fetch_error: Optional[str] = None  # 上次抓取失败的错误信息
    is_active: bool
    created_at: datetime
    items_count: Optional[int] = None
    unread_count: Optional[int] = None
    warning: Optional[str] = None  # 订阅存在问题时的警告信息

    class Config:
        from_attributes = True
        populate_by_name = True
        
        # Convert snake_case to camelCase for JSON
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )


class ItemsListResponse(BaseModel):
    items: List[FeedItemResponse]
    total: int
    page: int
    limit: int
    has_more: bool

    class Config:
        populate_by_name = True
        
        # Convert snake_case to camelCase for JSON
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )
