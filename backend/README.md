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

## API 文档

启动后访问:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc
