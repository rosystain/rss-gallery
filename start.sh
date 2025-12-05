#!/bin/bash

# RSS Gallery 启动脚本
# 同时启动前端和后端服务

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 清理函数
cleanup() {
    log_info "正在停止服务..."
    
    # 停止后端
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        log_info "后端服务已停止"
    fi
    
    # 停止前端
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        log_info "前端服务已停止"
    fi
    
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 检查目录
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "后端目录不存在: $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

echo ""
echo "=========================================="
echo "       RSS Gallery 开发服务器"
echo "=========================================="
echo ""

# 启动后端
log_info "启动后端服务..."
cd "$BACKEND_DIR"

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

if [ -f "start.sh" ]; then
    bash start.sh &
    BACKEND_PID=$!
else
    uvicorn app.main:app --reload --host 127.0.0.1 --port 3001 &
    BACKEND_PID=$!
fi

sleep 2

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_success "后端服务已启动 (PID: $BACKEND_PID)"
    log_info "后端地址: http://127.0.0.1:3001"
else
    log_error "后端服务启动失败"
    exit 1
fi

echo ""

# 启动前端
log_info "启动前端服务..."
cd "$FRONTEND_DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    log_warn "未找到 node_modules，正在安装依赖..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

sleep 3

if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_success "前端服务已启动 (PID: $FRONTEND_PID)"
    log_info "前端地址: http://localhost:5173"
else
    log_error "前端服务启动失败"
    cleanup
    exit 1
fi

echo ""
echo "=========================================="
log_success "所有服务已启动!"
echo ""
echo "  前端: http://localhost:5173"
echo "  后端: http://127.0.0.1:3001"
echo "  API:  http://127.0.0.1:3001/docs"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="
echo ""

# 等待子进程
wait
