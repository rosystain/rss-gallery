# RSS Gallery

RSS Gallery 是一个现代化的图片订阅墙，支持多源 RSS 聚合、自动抓取封面、已读追踪、筛选与批量操作，适合个人和小团队内容流管理。

## 快速启动

### 1. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务将在 `http://localhost:3001` 启动

### 2. 启动前端服务

在新终端窗口中：

```bash
cd frontend
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

## 功能亮点
- 多源 RSS 聚合
- 图片墙瀑布流展示
- 自动封面提取
- 已读/未读追踪与筛选
- 批量标记已读
- 自动加载更多
- 响应式设计，移动端友好
- Docker 一键部署
- GitHub Actions 自动构建

## 测试步骤

### 1. 添加RSS订阅源

打开浏览器访问 `http://localhost:5173`，点击"添加订阅"按钮，输入以下测试RSS源：

**推荐测试源：**
- **阮一峰的网络日志**: `https://www.ruanyifeng.com/blog/atom.xml`
- **少数派**: `https://sspai.com/feed`
- **V2EX**: `https://www.v2ex.com/index.xml`
- **掘金前端**: `https://juejin.cn/rss/tag/前端`
- **GitHub Blog**: `https://github.blog/feed/`

### 2. 等待数据加载

- 后端会自动解析RSS并提取封面图
- 第一次添加订阅后约2秒后会自动抓取数据
- 后续每30分钟自动更新一次

### 3. 测试功能

✅ **图片墙展示**
- 查看瀑布流布局
- 测试响应式设计（调整浏览器窗口大小）
- 图片懒加载

✅ **弹窗功能**
- 点击任意卡片查看详情
- 查看完整文章内容
- 点击"查看原文"跳转到原网站
- 按ESC键或点击背景关闭弹窗

✅ **筛选功能**
- 点击顶部订阅源标签进行筛选
- 查看每个订阅源的文章数量

✅ **加载更多**
- 滚动到底部点击"加载更多"
- 测试分页功能

## API 测试

### 使用 curl 测试后端API：

```bash
# 1. 检查服务健康状态
curl http://localhost:3001/health

# 2. 获取所有订阅源
curl http://localhost:3001/api/feeds

# 3. 添加新订阅源
curl -X POST http://localhost:3001/api/feeds \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.ruanyifeng.com/blog/atom.xml"}'

# 4. 获取文章列表
curl "http://localhost:3001/api/items?page=1&limit=10"

# 5. 手动触发RSS抓取（替换{feedId}为实际ID）
curl -X POST http://localhost:3001/api/feeds/{feedId}/fetch
```

## 使用 Prisma Studio 查看数据库

```bash
cd backend
npx prisma studio
```

访问 `http://localhost:5555` 查看数据库内容

## 常见问题

### 1. 端口被占用
修改 `backend/.env` 中的 `PORT=3001` 为其他端口

### 2. 图片加载失败
- 检查后端 `uploads` 目录是否有写权限
- 某些RSS源的图片可能有防盗链

### 3. RSS解析失败
- 确认RSS URL是否正确
- 某些网站需要特殊的User-Agent或代理

### 4. CORS错误
后端已配置CORS，如果仍有问题，检查端口配置是否正确

## 目录结构

```
rss-image-wall/
├── backend/
│   ├── src/              # 源代码
│   ├── prisma/           # 数据库schema
│   ├── uploads/          # 图片存储
│   └── dev.db            # SQLite数据库
├── frontend/
│   └── src/
│       ├── components/   # React组件
│       ├── services/     # API调用
│       └── types/        # TypeScript类型
└── README.md
```

## 下一步优化建议

- [ ] 添加搜索功能
- [ ] 支持收藏和标记已读
- [ ] 支持导入/导出OPML订阅文件
- [ ] 添加深色模式
- [ ] 优化图片加载性能
- [ ] 添加用户认证

## 许可证
MIT
