from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text, ForeignKey, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/rss_wall.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Feed(Base):
    __tablename__ = "feeds"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    url = Column(String, unique=True, nullable=False)
    site_url = Column(String)
    description = Column(Text)
    favicon = Column(String)
    category = Column(String)
    update_interval = Column(Integer, default=30)
    last_fetched_at = Column(DateTime)
    last_fetch_error = Column(String)  # 上次抓取失败的错误信息，成功时为 None
    is_active = Column(Boolean, default=True)
    enabled_integrations = Column(Text)  # JSON 数组，存储启用的集成 ID，null 表示全部启用
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("FeedItem", back_populates="feed", cascade="all, delete-orphan")


class FeedItem(Base):
    __tablename__ = "feed_items"

    id = Column(String, primary_key=True, index=True)
    feed_id = Column(String, ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    link = Column(String, unique=True, nullable=False)
    description = Column(Text)
    content = Column(Text)
    cover_image = Column(String)
    thumbnail_image = Column(String)
    author = Column(String)
    categories = Column(String)  # JSON string
    published_at = Column(DateTime, nullable=False)
    is_read = Column(Boolean, default=False)  # 已读状态
    read_at = Column(DateTime)  # 标记已读的时间
    is_favorite = Column(Boolean, default=False)  # 收藏状态
    favorited_at = Column(DateTime)  # 标记收藏的时间
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    feed = relationship("Feed", back_populates="items")


class FeedReadStatus(Base):
    __tablename__ = "feed_read_status"

    id = Column(String, primary_key=True, index=True)
    feed_id = Column(String, ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False, unique=True)
    last_viewed_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Integration(Base):
    """集成配置"""
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'url' or 'webhook'
    icon = Column(String, default='link')
    url = Column(String)  # URL 跳转类型使用
    webhook_url = Column(String)  # Webhook 类型使用
    webhook_method = Column(String, default='GET')  # 'GET' or 'POST'
    webhook_body = Column(Text)  # POST 请求体
    sort_order = Column(Integer, default=0)  # 排序顺序
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_db():
    """自动迁移数据库，添加缺失的列"""
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        # 检查 feeds 表
        if 'feeds' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('feeds')]
            
            # 添加 enabled_integrations 列
            if 'enabled_integrations' not in columns:
                print("Migrating: Adding enabled_integrations column to feeds table...")
                conn.execute(text("ALTER TABLE feeds ADD COLUMN enabled_integrations TEXT"))
                conn.commit()
                print("Migration complete: enabled_integrations column added")
        
        # 检查 feed_items 表
        if 'feed_items' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('feed_items')]
            
            # 添加 is_favorite 列
            if 'is_favorite' not in columns:
                print("Migrating: Adding is_favorite column to feed_items table...")
                conn.execute(text("ALTER TABLE feed_items ADD COLUMN is_favorite BOOLEAN DEFAULT 0"))
                conn.commit()
                print("Migration complete: is_favorite column added")
            
            # 添加 favorited_at 列
            if 'favorited_at' not in columns:
                print("Migrating: Adding favorited_at column to feed_items table...")
                conn.execute(text("ALTER TABLE feed_items ADD COLUMN favorited_at DATETIME"))
                conn.commit()
                print("Migration complete: favorited_at column added")
        
        # 检查 integrations 表是否存在，不存在则创建
        if 'integrations' not in inspector.get_table_names():
            print("Migrating: Creating integrations table...")
            Base.metadata.tables['integrations'].create(bind=engine)
            print("Migration complete: integrations table created")


def init_db():
    Base.metadata.create_all(bind=engine)
    migrate_db()
