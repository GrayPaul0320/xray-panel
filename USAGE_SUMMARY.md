# 快速使用指南

## 一、设置 GitHub 仓库（首次使用）

```bash
# 1. 快速设置（替换为你的 GitHub 用户名）
bash setup_github.sh YOUR_GITHUB_USERNAME

# 2. 在 GitHub 创建仓库
访问: https://github.com/new
仓库名: xray-panel
可见性: Public

# 3. 推送代码
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main

# 4. 构建并发布 Release
bash release.sh v1.0.0

# 5a. 使用 GitHub CLI 发布（推荐）
gh auth login
cd release/v1.0.0
gh release create v1.0.0 ./* --title "Release v1.0.0"
cd ../..

# 或 5b. 手动上传到 GitHub Release 页面
访问: https://github.com/YOUR_USERNAME/xray-panel/releases/new
上传 release/v1.0.0/ 下的所有文件

# 或 5c. 使用 GitHub Actions 自动发布
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## 二、启动 Master 服务

```bash
# 1. 配置环境变量
nano .env
# 设置 MASTER_HOST（你的域名或公网IP）
# 设置 GITHUB_REPO（你的GitHub仓库）

# 2. 初始化数据库
cd scripts && bash init_db.sh && cd ..

# 3. 编译项目
bash build.sh

# 4. 构建前端
cd web && npm run build && cd ..

# 5. 启动服务
bash start.sh

# 访问前端
http://localhost:3000
```

## 三、添加 Slave 节点

### 在 Master 前端操作：

1. 访问 `http://localhost:3000`
2. 进入 Slave 管理页面
3. 点击"添加 Slave"
4. 输入 Slave 名称（只需名称）
5. 复制生成的安装命令

### 在 Slave 服务器执行：

```bash
# 粘贴从前端复制的安装命令，类似：
curl -sSL 'http://your-domain:9091/api/slaves/1/install' | sudo bash

# 查看服务状态
sudo systemctl status xray-panel-slave

# 查看日志
sudo journalctl -u xray-panel-slave -f
```

安装脚本会自动：
- 检测系统架构
- 从 GitHub Release 下载对应的 Slave 二进制文件
- 下载 Xray Core
- 创建 systemd 服务
- 启动服务并自动上报 IP

## 四、常用命令

### Master 管理
```bash
# 启动
bash start.sh

# 停止
pkill -f 'bin/master'
pkill -f 'http-server'

# 查看日志
tail -f logs/master.log
tail -f logs/frontend.log

# 重启
pkill -f 'bin/master' && sleep 1 && bash start.sh
```

### Slave 管理
```bash
# 启动
sudo systemctl start xray-panel-slave

# 停止
sudo systemctl stop xray-panel-slave

# 重启
sudo systemctl restart xray-panel-slave

# 查看状态
sudo systemctl status xray-panel-slave

# 查看日志
sudo journalctl -u xray-panel-slave -f

# 卸载
sudo systemctl stop xray-panel-slave
sudo systemctl disable xray-panel-slave
sudo rm /etc/systemd/system/xray-panel-slave.service
sudo rm -rf /opt/xray-panel
```

## 五、更新版本

### 更新 Master
```bash
git pull
bash build.sh
cd web && npm run build && cd ..
pkill -f 'bin/master'
bash start.sh
```

### 更新 Slave
```bash
# 1. 发布新版本到 GitHub Release
bash release.sh v1.0.1
gh release create v1.0.1 release/v1.0.1/* --title "Release v1.0.1"

# 2. 在 Slave 服务器上重新运行安装脚本
curl -sSL 'http://your-domain:9091/api/slaves/1/install' | sudo bash
```

## 六、故障排查

### Slave 无法连接 Master
```bash
# 检查网络连接
curl http://your-master-domain:9091/health

# 检查防火墙
sudo ufw status
sudo ufw allow 9091

# 查看 Slave 日志
sudo journalctl -u xray-panel-slave -n 50
```

### GitHub Release 下载失败
```bash
# 测试下载链接
curl -I https://github.com/YOUR_USERNAME/xray-panel/releases/latest/download/slave-linux-amd64

# 检查 Release 是否存在
访问: https://github.com/YOUR_USERNAME/xray-panel/releases

# 确认 .env 中 GITHUB_REPO 配置正确
cat .env | grep GITHUB_REPO
```

### 数据库连接失败
```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 测试连接
psql -U xray_admin -d xray_panel -c "SELECT version();"

# 重新初始化数据库
cd scripts && bash init_db.sh
```

## 七、文档链接

- [快速开始](QUICK_START.md) - 详细的部署指南
- [GitHub 设置](GITHUB_SETUP.md) - GitHub 仓库和 Release 配置
- [README](README.md) - 项目概述和架构说明

## 八、脚本说明

- `build.sh` - 编译 Master 和 Slave
- `start.sh` - 启动 Master 和前端服务
- `release.sh` - 构建多平台 Release 文件
- `setup_github.sh` - 快速配置 GitHub 仓库
