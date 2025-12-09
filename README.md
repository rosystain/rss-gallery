# RSS Gallery

一个基于 RSS 的图片墙应用，使用 FastAPI 后端和 React 前端。

## 功能特性

- RSS 订阅管理
- 自动图片抓取和缩略图生成
- 响应式图片墙界面
- 已读/未读状态管理
- 按类别和搜索过滤
- [自定义集成](docs/custom-integrations.md)（URL 跳转、Webhook）

## Docker 部署

### 拉取镜像

```bash
docker pull ghcr.io/rosystain/rss-gallery:latest
```

### 运行容器

运行容器并映射数据目录：

```bash
docker run -v /path/to/your/config:/app/backend/data -p 5002:5002 ghcr.io/rosystain/rss-gallery:latest
```

### 访问应用

打开浏览器访问：`http://localhost:5002`

### 数据持久化说明

容器内的 `/app/backend/data` 目录包含：
- `rss_wall.db`：SQLite 数据库文件
- `uploads/`：上传的图片文件目录

通过 `-v` 参数映射到宿主机目录，确保数据在容器重启后不丢失。

### 端口说明

- 容器内部端口：5002


前端开发服务器运行在 `http://localhost:5173`，会代理 API 请求到 `http://localhost:3001`。

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | `sqlite:///./data/rss_wall.db` | 数据库连接字符串 |
| `DATA_DIR` | `./data` | 数据存储目录 |
| `FETCH_INTERVAL_MINUTES` | `30` | RSS 自动抓取间隔（分钟） |
| `THUMBNAIL_WIDTH` | `600` | 缩略图最大宽度（像素） |
| `THUMBNAIL_HEIGHT` | `1200` | 缩略图最大高度（像素） |
| `CACHE_SIZE_LIMIT_MB` | `1000` | 图片缓存大小上限（MB），设为 0 表示无限制 |
| `MAX_ITEMS_PER_FEED` | `1000` | 每个 Feed 最多保留条目数，设为 0 表示无限制 |
| `RSS_REQUEST_TIMEOUT` | `60` | RSS 请求超时时间（秒） |
| `RSS_MAX_RETRIES` | `2` | RSS 请求失败重试次数 |
| `RSS_RETRY_DELAY` | `3` | RSS 请求重试间隔（秒） |

### Docker 中使用环境变量

```bash
docker run -d \
  -v /path/to/data:/app/backend/data \
  -p 5002:5002 \
  -e CACHE_SIZE_LIMIT_MB=1000 \
  -e FETCH_INTERVAL_MINUTES=60 \
  ghcr.io/rosystain/rss-gallery:latest
```

## API 文档

启动后端后，访问 `http://localhost:3001/docs` 查看 Swagger API 文档。

## 许可证

MIT License