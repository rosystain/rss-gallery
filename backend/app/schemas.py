from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FeedBase(BaseModel):
    url: str
    category: Optional[str] = None


class FeedCreate(FeedBase):
    enabled_integrations: Optional[List[str]] = None  # None 表示全部启用


class FeedUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    enabled_integrations: Optional[List[str]] = None  # None 表示不修改，空列表表示禁用所有


class FeedBriefResponse(BaseModel):
    """用于 FeedItem 嵌套的简化 Feed 信息"""
    title: str
    category: Optional[str] = None
    favicon: Optional[str] = None
    enabled_integrations: Optional[List[str]] = None  # 该 feed 启用的集成 ID 列表
    
    class Config:
        from_attributes = True
        populate_by_name = True
        
        # Convert snake_case to camelCase for JSON
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )
        
        # 确保 datetime 序列化为 ISO 8601 格式并带 Z 后缀（UTC）
        json_encoders = {
            datetime: lambda v: v.isoformat() + 'Z' if v.tzinfo is None else v.isoformat()
        }


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
    feed: Optional[FeedBriefResponse] = None
    is_unread: Optional[bool] = None
    is_favorite: Optional[bool] = None
    komga_status: Optional[int] = None
    komga_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True
        
        # Convert snake_case to camelCase for JSON
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )
        
        # 确保 datetime 序列化为 ISO 8601 格式并带 Z 后缀（UTC）
        json_encoders = {
            datetime: lambda v: v.isoformat() + 'Z' if v.tzinfo is None else v.isoformat()
        }


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
    enabled_integrations: Optional[List[str]] = None  # 启用的集成ID列表，None表示全部启用

    class Config:
        from_attributes = True
        populate_by_name = True
        
        # Convert snake_case to camelCase for JSON
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )
        
        # 确保 datetime 序列化为 ISO 8601 格式并带 Z 后缀（UTC）
        json_encoders = {
            datetime: lambda v: v.isoformat() + 'Z' if v.tzinfo is None else v.isoformat()
        }


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


# 集成相关 Schema
class IntegrationBase(BaseModel):
    name: str
    type: str  # 'url' or 'webhook'
    icon: Optional[str] = 'link'
    url: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_method: Optional[str] = 'GET'
    webhook_body: Optional[str] = None
    sort_order: Optional[int] = 0


class IntegrationCreate(IntegrationBase):
    pass


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    icon: Optional[str] = None
    url: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_method: Optional[str] = None
    webhook_body: Optional[str] = None
    sort_order: Optional[int] = None


class IntegrationResponse(BaseModel):
    id: str
    name: str
    type: str
    icon: Optional[str]
    url: Optional[str]
    webhook_url: Optional[str]
    webhook_method: Optional[str]
    webhook_body: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
        
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )
        
        # 确保 datetime 序列化为 ISO 8601 格式并带 Z 后缀（UTC）
        json_encoders = {
            datetime: lambda v: v.isoformat() + 'Z' if v.tzinfo is None else v.isoformat()
        }


# ========== 预设集成相关 Schema ==========

class PresetIntegrationUpdate(BaseModel):
    enabled: Optional[bool] = None
    api_url: Optional[str] = None
    config: Optional[dict] = None
    default_favcat: Optional[str] = None
    default_note: Optional[str] = None


class PresetIntegrationResponse(BaseModel):
    id: str
    enabled: bool
    api_url: Optional[str]
    config: Optional[dict]
    default_favcat: Optional[str]
    default_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
        
        alias_generator = lambda string: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(string.split('_'))
        )
        
        # 确保 datetime 序列化为 ISO 8601 格式并带 Z 后缀（UTC）
        json_encoders = {
            datetime: lambda v: v.isoformat() + 'Z' if v.tzinfo is None else v.isoformat()
        }
