# Xray Panel 快速开始指南

## 环境要求

- Go 1.21+
- PostgreSQL 13+
- Node.js 16+
- Linux 系统

## 一、准备工作

### 1. 克隆项目

```bash
git clone <repository-url>
cd panel
```

### 2. 安装依赖

```bash
# 安装 Go 依赖
go mod download

# 安装前端依赖
cd web && npm install && cd ..
```

## 二、配置

### 1. 配置 Master

编辑 `.env` 文件：

```bash
# Master 配置
MASTER_HOST=your-domain.com  # 或服务器 IP 地址
MASTER_PORT=9091

# 数据库配置
DB_DSN=postgres://xray_admin:xray123456@localhost:5432/xray_panel?sslmode=disable
```

### 2. 初始化数据库

```bash
cd scripts
bash init_db.sh
cd ..
```

## 三、编译和启动

### 方式一：一键启动（推荐）

```bash
# 1. 编译项目
bash build.sh

# 2. 构建前端
cd web && npm run build && cd ..

# 3. 启动服务
bash start.sh
```

### 方式二：手动启动

```bash
# 启动 Master
./bin/master -db "postgres://xray_admin:xray123456@localhost:5432/xray_panel?sslmode=disable" -listen :9091
```

## 四、添加 Slave 节点

### 1. 在前端添加 Slave

1. 访问 `http://localhost:9091`
2. 进入 Slave 管理页面
3. 点击"添加 Slave"
4. 输入 Slave 名称（只需要名称，IP 会自动上报）
5. 复制生成的安装命令

### 2. 在 Slave 服务器执行命令

在目标服务器上执行复制的安装命令，Slave 会自动：
- 下载并安装 Slave 程序
- 连接到 Master
- 上报自己的 IP 地址

## 五、管理服务

### 查看日志

```bash
tail -f logs/master.log
```

### 停止服务

```bash
pkill -f 'bin/master'
```

### 重启服务

```bash
pkill -f 'bin/master'
sleep 1
bash start.sh
```

## 六、常见问题

### Q: 无法连接数据库？

检查 `.env` 中的数据库连接字符串是否正确。

### Q: Slave 无法连接？

1. 检查 `MASTER_HOST` 是否配置为外网可访问的地址
2. 检查防火墙是否开放了 `MASTER_PORT` 端口
3. 检查 Master 服务是否正常运行

### Q: 如何更新配置？

修改 `.env` 后，需要重启服务：
```bash
pkill -f 'bin/master'
bash start.sh
```

## 七、下一步

- 查看 [README.md](README.md) 了解更多功能
- 配置 Xray 节点和用户
- 查看流量统计和监控数据
