#!/bin/bash
# Komga 功能后端验证脚本

echo "========================================="
echo "Komga 库存查询功能 - 后端验证"
echo "========================================="
echo ""

# 检查数据库迁移
echo "1. 检查数据库迁移文件..."
if [ -f "/home/coder/dev/rss-gallery/backend/alembic/versions/7a8b9c0d1e2f_add_komga_fields_to_feed_items.py" ]; then
    echo "✓ 迁移文件已创建"
else
    echo "✗ 迁移文件未找到"
fi
echo ""

# 检查数据库模型
echo "2. 检查数据库模型更新..."
if grep -q "komga_status" /home/coder/dev/rss-gallery/backend/app/database.py; then
    echo "✓ FeedItem 模型已包含 komga_status 字段"
else
    echo "✗ FeedItem 模型缺少 komga_status 字段"
fi

if grep -q "komga_sync_at" /home/coder/dev/rss-gallery/backend/app/database.py; then
    echo "✓ FeedItem 模型已包含 komga_sync_at 字段"
else
    echo "✗ FeedItem 模型缺少 komga_sync_at 字段"
fi
echo ""

# 检查 schemas
echo "3. 检查 API schemas..."
if grep -q "komga_status" /home/coder/dev/rss-gallery/backend/app/schemas.py; then
    echo "✓ FeedItemResponse 已包含 komga_status 字段"
else
    echo "✗ FeedItemResponse 缺少 komga_status 字段"
fi
echo ""

# 检查辅助函数
echo "4. 检查 Komga 查询辅助函数..."
if grep -q "async def query_komga_status" /home/coder/dev/rss-gallery/backend/app/main.py; then
    echo "✓ query_komga_status 函数已实现"
else
    echo "✗ query_komga_status 函数未找到"
fi

if grep -q "def update_items_komga_status" /home/coder/dev/rss-gallery/backend/app/main.py; then
    echo "✓ update_items_komga_status 函数已实现"
else
    echo "✗ update_items_komga_status 函数未找到"
fi
echo ""

# 检查 API 路由
echo "5. 检查 API 路由..."
if grep -q "@app.post(\"/api/items/query-komga\")" /home/coder/dev/rss-gallery/backend/app/main.py; then
    echo "✓ POST /api/items/query-komga 路由已添加"
else
    echo "✗ POST /api/items/query-komga 路由未找到"
fi
echo ""

# 检查依赖
echo "6. 检查依赖..."
if grep -q "httpx" /home/coder/dev/rss-gallery/backend/requirements.txt; then
    echo "✓ httpx 依赖已添加到 requirements.txt"
else
    echo "✗ httpx 依赖未添加"
fi
echo ""

echo "========================================="
echo "验证完成！"
echo "========================================="
echo ""
echo "下一步："
echo "1. 启动后端服务以运行数据库迁移"
echo "2. 在集成设置中启用 Hentai Assistant 并配置 API URL"
echo "3. 添加或刷新 RSS 订阅以测试自动查询"
echo "4. 使用 curl 测试 /api/items/query-komga 接口"
