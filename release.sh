#!/bin/bash

# Xray Panel Release 脚本
# 用于编译并准备 GitHub Release 文件

set -e

echo "========================================"
echo "Xray Panel Release 构建"
echo "========================================"

# 版本号（可以通过参数传入）
VERSION=${1:-"v1.0.0"}
echo "版本: $VERSION"

# 创建 release 目录
RELEASE_DIR="release/$VERSION"
mkdir -p $RELEASE_DIR

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

echo ""
echo "编译 Slave 程序..."

# 编译 Linux x86_64
echo "  - Linux x86_64..."
GOOS=linux GOARCH=amd64 go build -o $RELEASE_DIR/slave-linux-amd64 -ldflags="-s -w" cmd/slave/main.go

# 编译 Linux ARM64
echo "  - Linux ARM64..."
GOOS=linux GOARCH=arm64 go build -o $RELEASE_DIR/slave-linux-arm64 -ldflags="-s -w" cmd/slave/main.go

# 编译 Linux ARM v7
echo "  - Linux ARMv7..."
GOOS=linux GOARCH=arm GOARM=7 go build -o $RELEASE_DIR/slave-linux-armv7 -ldflags="-s -w" cmd/slave/main.go

# 创建通用的 slave 二进制（默认 amd64）
cp $RELEASE_DIR/slave-linux-amd64 $RELEASE_DIR/slave
chmod +x $RELEASE_DIR/slave-*

echo ""
echo "编译 Master 程序..."
GOOS=linux GOARCH=amd64 go build -o $RELEASE_DIR/master-linux-amd64 -ldflags="-s -w" cmd/master/main.go
cp $RELEASE_DIR/master-linux-amd64 $RELEASE_DIR/master
chmod +x $RELEASE_DIR/master-*

echo ""
echo "创建校验和..."
cd $RELEASE_DIR
sha256sum * > SHA256SUMS
cd ../..

echo ""
echo "========================================"
echo "✓ 构建完成！"
echo "========================================"
echo "输出目录: $RELEASE_DIR"
echo ""
echo "文件列表:"
ls -lh $RELEASE_DIR
echo ""
echo "下一步："
echo "1. 创建 GitHub 仓库（如果还没有）"
echo "2. 推送代码到 GitHub"
echo "3. 创建 Release 并上传文件："
echo "   - 使用 GitHub Web UI 创建 Release"
echo "   - 或使用 GitHub CLI: gh release create $VERSION $RELEASE_DIR/* --title \"Release $VERSION\""
echo ""
echo "4. 更新 .env 中的 GITHUB_REPO 变量"
echo "   例如: GITHUB_REPO=username/xray-panel"
echo "========================================"
