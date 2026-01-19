#!/bin/bash

# 加载环境变量配置文件
if [ -f .env ]; then
    echo "正在加载配置文件 .env..."
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "警告: .env 配置文件不存在"
    exit 1
fi

echo "========================================"
echo "启动 Xray Panel"
echo "========================================"

# 检查必要的文件
if [ ! -f "bin/master" ]; then
    echo "错误: bin/master 不存在，请先运行 build.sh 编译项目"
    exit 1
fi

if [ ! -d "web/dist" ]; then
    echo "错误: web/dist 目录不存在，请先构建前端"
    echo "运行: cd web && npm run build"
    exit 1
fi

# 检查数据库连接
if [ -z "$DB_DSN" ]; then
    echo "错误: 未配置 DB_DSN 环境变量"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 停止已运行的进程
echo "检查并停止已运行的进程..."
pkill -f "bin/master" 2>/dev/null
pkill -f "http-server.*web/dist" 2>/dev/null
sleep 1

# 启动 Master 节点
echo "启动 Master 节点..."
nohup ./bin/master -db "$DB_DSN" -listen :$MASTER_PORT > logs/master.log 2>&1 &
MASTER_PID=$!
echo "Master 已启动 (PID: $MASTER_PID)"

# 等待 Master 启动
sleep 2

# 检查 Master 是否运行
if ! ps -p $MASTER_PID > /dev/null; then
    echo "错误: Master 启动失败，查看日志: logs/master.log"
    exit 1
fi

# 启动前端服务
echo "启动前端服务..."
# 检查是否安装了 http-server
if ! command -v npx &> /dev/null; then
    echo "警告: npx 未安装，跳过前端启动"
    echo "请手动启动前端: cd web && npx http-server dist -p 3000"
else
    cd web
    nohup npx http-server dist -p 3000 --proxy http://localhost:$MASTER_PORT > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    echo "前端已启动 (PID: $FRONTEND_PID, 端口: 3000)"
    sleep 1
    
    # 检查前端是否运行
    if ! ps -p $FRONTEND_PID > /dev/null; then
        echo "警告: 前端启动失败，查看日志: logs/frontend.log"
    fi
fi

echo "========================================"
echo "✓ Xray Panel 启动成功！"
echo "========================================"
echo "前端地址: http://localhost:3000"
echo "Master API: http://localhost:$MASTER_PORT"
echo "日志文件:"
echo "  - Master: logs/master.log"
echo "  - 前端: logs/frontend.log"
echo ""
echo "停止服务:"
echo "  - 全部: pkill -f 'bin/master'; pkill -f 'http-server'"
echo "  - Master: pkill -f 'bin/master'"
echo "  - 前端: pkill -f 'http-server'"
echo "查看日志:"
echo "  - Master: tail -f logs/master.log"
echo "  - 前端: tail -f logs/frontend.log"
echo "========================================"
