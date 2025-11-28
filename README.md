# RSS Gallery

一个基于 RSS 的图片墙应用，使用 FastAPI 后端和 React 前端。

## 功能特性

- RSS 订阅管理
- 自动图片抓取和缩略图生成
- 响应式图片墙界面
- 已读/未读状态管理
- 按类别和搜索过滤

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


## 本地开发

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3001
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`，会代理 API 请求到 `http://localhost:3001`。

## 环境变量

- `DATABASE_URL`：数据库连接字符串（默认：`sqlite:///./data/rss_wall.db`）
- `DATA_DIR`：数据目录（默认：`./data`）
- `UPLOAD_DIR`：上传目录（默认：`./data/uploads`）
- `FETCH_INTERVAL_MINUTES`：RSS 抓取间隔（默认：30 分钟）

## API 文档

启动后端后，访问 `http://localhost:3001/docs` 查看 Swagger API 文档。

## 许可证

MIT License