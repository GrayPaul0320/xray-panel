#!/bin/bash

# 加载环境变量配置文件
if [ -f .env ]; then
    echo "正在加载配置文件 .env..."
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
    echo "配置加载完成："
    echo "  MASTER_HOST=$MASTER_HOST"
    echo "  MASTER_PORT=$MASTER_PORT"
else
    echo "警告: .env 配置文件不存在，使用默认配置"
fi

echo "构建 Xray Panel..."

# 构建 Master 节点
echo "构建 Master 节点..."
go build -o bin/master cmd/master/main.go

# 构建 Slave 节点
echo "构建 Slave 节点..."
go build -o bin/slave cmd/slave/main.go

echo "构建完成！"
echo "二进制文件位于 bin/ 目录"
echo "========================================="
echo "构建前端 UI"
echo "正在构建前端 UI..."   
cd web && npm install && npm run build && cd ..
echo "前端 UI 构建完成！"
echo "前端 UI 文件位于 web/dist/ 目录"
echo "========================================="    