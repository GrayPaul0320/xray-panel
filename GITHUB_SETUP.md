# GitHub 仓库设置和 Release 发布指南

## 第一步：创建 GitHub 仓库

### 1. 在 GitHub 上创建新仓库

```bash
# 访问 GitHub 并创建新仓库
# 仓库名称建议: xray-panel
# 可见性: Public 或 Private（Private 需要额外配置访问权限）
```

### 2. 初始化 Git 并推送代码

```bash
cd /home/graypaul/Projects/panel

# 初始化 Git（如果还没有）
git init

# 添加远程仓库（替换为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/xray-panel.git

# 或使用 SSH
git remote add origin git@github.com:YOUR_USERNAME/xray-panel.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Xray Panel with auto-discovery"

# 推送到 GitHub
git push -u origin main
# 如果默认分支是 master，使用: git push -u origin master
```

## 第二步：更新配置

### 1. 修改 .env 文件

```bash
nano .env
```

更新以下配置：

```bash
# Master 配置
MASTER_HOST=your-domain.com  # 改为你的域名或公网 IP
MASTER_PORT=9091

# GitHub 仓库配置
GITHUB_REPO=YOUR_USERNAME/xray-panel  # 改为你的 GitHub 用户名/仓库名

# 数据库连接
DB_DSN=postgres://xray_admin:xray123456@localhost:5432/xray_panel?sslmode=disable
```

### 2. 重新编译 Master

```bash
bash build.sh
```

## 第三步：创建 Release

### 方式一：使用本地脚本构建（推荐）

```bash
# 执行 release 脚本，构建所有平台的二进制文件
bash release.sh v1.0.0

# 输出文件在 release/v1.0.0/ 目录
ls -lh release/v1.0.0/
```

### 方式二：使用 GitHub Actions 自动构建

```bash
# 创建并推送 tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# GitHub Actions 会自动构建并创建 Release
# 等待几分钟后，在 GitHub 仓库的 Releases 页面查看
```

### 方式三：手动上传到 GitHub Release

1. 先运行本地构建脚本：
```bash
bash release.sh v1.0.0
```

2. 在 GitHub 仓库页面：
   - 点击 "Releases"
   - 点击 "Create a new release"
   - Tag version: `v1.0.0`
   - Release title: `Release v1.0.0`
   - 上传 `release/v1.0.0/` 目录下的所有文件
   - 点击 "Publish release"

### 使用 GitHub CLI（如果已安装）

```bash
# 安装 GitHub CLI
# Ubuntu/Debian: sudo apt install gh
# 或访问: https://cli.github.com/

# 登录
gh auth login

# 创建 Release 并上传文件
bash release.sh v1.0.0
cd release/v1.0.0
gh release create v1.0.0 ./* \
  --title "Release v1.0.0" \
  --notes "第一个正式版本，支持 Slave 自动上报 IP"
cd ../..
```

## 第四步：验证 Release

### 1. 检查 Release 页面

访问：`https://github.com/YOUR_USERNAME/xray-panel/releases`

确认以下文件存在：
- `slave-linux-amd64`
- `slave-linux-arm64`
- `slave-linux-armv7`
- `master-linux-amd64`
- `SHA256SUMS`

### 2. 测试下载链接

```bash
# 测试下载（替换为你的仓库）
curl -L -o test-slave https://github.com/YOUR_USERNAME/xray-panel/releases/latest/download/slave-linux-amd64
chmod +x test-slave
./test-slave --help
rm test-slave
```

## 第五步：使用安装脚本

### 1. 重启 Master 服务

```bash
pkill -f 'bin/master'
bash start.sh
```

### 2. 在前端添加 Slave

1. 访问 `http://your-domain:9091`
2. 添加 Slave，只需输入名称
3. 复制生成的安装命令

### 3. 在 Slave 服务器执行安装

```bash
# 复制的命令类似：
curl -sSL 'http://your-domain:9091/api/slaves/1/install' | sudo bash

# 或者手动下载脚本后执行：
curl -sSL 'http://your-domain:9091/api/slaves/1/install' > install.sh
sudo bash install.sh
```

安装脚本会自动：
1. 检测系统架构
2. 从 GitHub Release 下载对应的 Slave 二进制文件
3. 下载 Xray Core
4. 创建 systemd 服务
5. 启动服务并自动上报 IP

## 故障排查

### Release 下载失败

1. **检查网络连接**
```bash
curl -I https://github.com
```

2. **检查仓库可见性**
   - Public 仓库：任何人都可以下载
   - Private 仓库：需要配置 Personal Access Token

3. **使用代理（如果需要）**
```bash
export https_proxy=http://proxy-server:port
```

### GitHub Actions 构建失败

1. 检查 Actions 页面的错误日志
2. 确认 Go 版本兼容
3. 检查代码是否有编译错误

### 安装脚本执行失败

1. **查看详细错误**
```bash
bash -x install.sh
```

2. **检查系统架构**
```bash
uname -m
```

3. **手动下载测试**
```bash
wget https://github.com/YOUR_USERNAME/xray-panel/releases/latest/download/slave-linux-amd64
```

## 更新 Release

### 创建新版本

```bash
# 修改代码后提交
git add .
git commit -m "Your changes"
git push

# 创建新版本
bash release.sh v1.0.1

# 推送 tag（如果使用 GitHub Actions）
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1

# 或使用 GitHub CLI 直接发布
cd release/v1.0.1
gh release create v1.0.1 ./* --title "Release v1.0.1" --notes "更新说明"
cd ../..
```

## 安全建议

1. **使用 HTTPS**
   - 配置 SSL 证书
   - 使用 Nginx 反向代理

2. **限制访问**
   - 设置防火墙规则
   - 使用强密码

3. **定期更新**
   - 及时更新 Xray Core
   - 更新系统安全补丁

## 参考链接

- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github
- GitHub CLI: https://cli.github.com/
- GitHub Actions: https://docs.github.com/en/actions
