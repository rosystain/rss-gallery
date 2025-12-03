# RSS Image Wall - Python Backend

基于 FastAPI 的 RSS 图片墙后端服务

## 安装

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

## 运行

```bash
# 开发模式
uvicorn app.main:app --reload --port 3001

# 或直接运行
python -m app.main
```

## 功能特性

- ✅ FastAPI 高性能异步框架
- ✅ SQLAlchemy ORM 数据库管理
- ✅ feedparser RSS 解析
- ✅ Pillow 图片处理和缩略图生成
- ✅ APScheduler 定时任务
- ✅ 自动处理防盗链
- ✅ WebP 格式优化

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DATA_DIR` | `./data` | 数据存储目录 |
| `DATABASE_URL` | `sqlite:///./data/rss_wall.db` | 数据库连接 URL |
| `FETCH_INTERVAL_MINUTES` | `30` | 自动抓取间隔（分钟） |
| `THUMBNAIL_WIDTH` | `600` | 缩略图最大宽度 |
| `THUMBNAIL_HEIGHT` | `1200` | 缩略图最大高度 |
| `CACHE_SIZE_LIMIT_MB` | `1000` | 图片缓存大小上限（MB），设为 0 表示无限制 |
| `MAX_ITEMS_PER_FEED` | `1000` | 每个 Feed 最多保留条目数，设为 0 表示无限制 |
| `RSS_REQUEST_TIMEOUT` | `60` | RSS 请求超时时间（秒） |
| `RSS_MAX_RETRIES` | `2` | RSS 请求失败重试次数 |
| `RSS_RETRY_DELAY` | `3` | RSS 请求重试间隔（秒） |

## API 文档

启动后访问:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc
