#!/bin/bash

# 快速设置 GitHub 仓库和发布 Release
# 使用方法: bash setup_github.sh YOUR_USERNAME

set -e

if [ -z "$1" ]; then
    echo "用法: bash setup_github.sh YOUR_GITHUB_USERNAME"
    echo "例如: bash setup_github.sh graypaul"
    exit 1
fi

GITHUB_USERNAME=$1
REPO_NAME="xray-panel"
VERSION="v1.0.0"

echo "========================================"
echo "GitHub 仓库快速设置"
echo "========================================"
echo "GitHub 用户名: $GITHUB_USERNAME"
echo "仓库名称: $REPO_NAME"
echo "版本: $VERSION"
echo ""

# 检查是否已经是 git 仓库
if [ ! -d ".git" ]; then
    echo "初始化 Git 仓库..."
    git init
    echo "✓ Git 仓库已初始化"
else
    echo "✓ 已存在 Git 仓库"
fi

# 更新 .env 文件
echo ""
echo "更新 .env 配置..."
if grep -q "GITHUB_REPO=" .env; then
    sed -i "s|GITHUB_REPO=.*|GITHUB_REPO=$GITHUB_USERNAME/$REPO_NAME|" .env
else
    echo "GITHUB_REPO=$GITHUB_USERNAME/$REPO_NAME" >> .env
fi
echo "✓ GITHUB_REPO 已设置为: $GITHUB_USERNAME/$REPO_NAME"

# 检查远程仓库
if git remote | grep -q "origin"; then
    CURRENT_REMOTE=$(git remote get-url origin)
    echo ""
    echo "当前远程仓库: $CURRENT_REMOTE"
    read -p "是否要更新为 GitHub 仓库? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote remove origin
        git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
        echo "✓ 远程仓库已更新"
    fi
else
    git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
    echo "✓ 远程仓库已添加: https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
fi

# 提示用户在 GitHub 创建仓库
echo ""
echo "========================================"
echo "请完成以下步骤："
echo "========================================"
echo ""
echo "1. 在 GitHub 上创建仓库（如果还没有）："
echo "   访问: https://github.com/new"
echo "   仓库名称: $REPO_NAME"
echo "   可见性: Public"
echo ""
echo "2. 提交并推送代码："
echo "   git add ."
echo "   git commit -m \"Initial commit\""
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. 构建 Release 文件："
echo "   bash release.sh $VERSION"
echo ""
echo "4. 创建 GitHub Release："
echo ""
echo "   方式一 - 使用 GitHub CLI (推荐):"
echo "   gh auth login"
echo "   cd release/$VERSION"
echo "   gh release create $VERSION ./* --title \"Release $VERSION\" --notes \"首个发布版本\""
echo "   cd ../.."
echo ""
echo "   方式二 - 使用 Web 界面:"
echo "   访问: https://github.com/$GITHUB_USERNAME/$REPO_NAME/releases/new"
echo "   - Tag: $VERSION"
echo "   - Title: Release $VERSION"
echo "   - 上传 release/$VERSION/ 下的所有文件"
echo ""
echo "   方式三 - 使用 GitHub Actions (自动):"
echo "   git tag -a $VERSION -m \"Release $VERSION\""
echo "   git push origin $VERSION"
echo "   (GitHub Actions 会自动构建并发布)"
echo ""
echo "5. 重新编译并启动 Master："
echo "   bash build.sh"
echo "   bash start.sh"
echo ""
echo "========================================"
echo "完成后，安装命令会自动从以下地址下载 Slave："
echo "https://github.com/$GITHUB_USERNAME/$REPO_NAME/releases/latest/download/slave-linux-amd64"
echo "========================================"
