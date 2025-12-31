# Alembic 数据库迁移指南

## 概述

本项目使用 Alembic 进行数据库架构管理。Alembic 会在应用启动时自动运行迁移。

## 用户使用

### 正常启动(自动迁移)

```bash
./start.sh
```

数据库迁移会自动执行,无需手动操作。

### 手动运行迁移(可选)

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

## 开发者使用

### 创建新迁移

当你修改了数据库模型(在 `app/database.py` 中),需要创建迁移:

```bash
cd backend
source .venv/bin/activate

# 自动生成迁移(推荐)
alembic revision --autogenerate -m "描述你的更改"

# 或手动创建迁移
alembic revision -m "描述你的更改"
```

### 查看迁移历史

```bash
# 查看所有迁移
alembic history

# 查看当前版本
alembic current

# 查看详细信息
alembic history --verbose
```

### 应用迁移

```bash
# 升级到最新版本
alembic upgrade head

# 升级一个版本
alembic upgrade +1

# 升级到特定版本
alembic upgrade <revision_id>
```

### 回滚迁移

```bash
# 回滚一个版本
alembic downgrade -1

# 回滚到特定版本
alembic downgrade <revision_id>

# 回滚所有迁移
alembic downgrade base
```

### 查看 SQL(不执行)

```bash
# 查看升级 SQL
alembic upgrade head --sql

# 查看降级 SQL
alembic downgrade -1 --sql
```

## 迁移文件位置

- **配置文件**: `backend/alembic.ini`
- **环境配置**: `backend/alembic/env.py`
- **迁移版本**: `backend/alembic/versions/`

## 注意事项

1. **不要手动编辑数据库**: 所有架构更改都应通过 Alembic 迁移
2. **提交迁移文件**: 迁移文件应该提交到 Git
3. **测试迁移**: 在生产环境应用前,先在测试环境验证
4. **备份数据**: 重要数据库操作前先备份

## 常见问题

### 迁移冲突

如果多人同时创建迁移,可能会出现冲突:

```bash
# 查看冲突的迁移
alembic branches

# 合并分支
alembic merge <rev1> <rev2> -m "merge migrations"
```

### 重置迁移历史

如果需要从头开始(仅开发环境):

```bash
# 删除数据库
rm data/rss_wall.db

# 重新运行迁移
alembic upgrade head
```

### 检查迁移状态

```bash
# 检查是否有待应用的迁移
alembic current
alembic heads
```

## 从旧系统迁移

如果你之前使用的是旧的手动迁移系统:

1. 拉取最新代码
2. 正常启动应用: `./start.sh`
3. Alembic 会自动处理迁移

旧的迁移代码已被移除,所有迁移现在由 Alembic 管理。
