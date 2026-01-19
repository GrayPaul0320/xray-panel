# Xray Panel - 多服务器管理系统

基于 Xray-core 的多服务器管理系统，采用 Master-Slave 架构，支持版本化配置同步和实时流量统计。

## ✨ 核心功能

### � 自动化部署 ⭐ NEW
- **一键安装**：Slave 节点一键安装脚本，自动下载和配置
- **自动上报**：Slave 连接后自动上报 IP 地址到 Master
- **多架构支持**：支持 x86_64、ARM64、ARMv7 架构
- **GitHub Release**：自动从 GitHub 下载最新版本

### 🔄 配置管理
- **版本化同步**：基于版本号的增量配置同步
- **JWT 认证**：安全的节点认证机制
- **WebSocket 通讯**：实时双向通信
- **自动重连**：Slave 节点断线自动重连

### 📊 监控统计
- **存活监测**：90秒心跳超时检测，自动标记离线
- **流量统计**：Xray Stats API 集成
  - 10 秒采样 + 60 秒聚合上报
  - 支持多 inbound 同时统计
  - PostgreSQL 原子累加存储
  - 低开销（< 0.5% CPU）
- **实时监控**：WebSocket 推送流量数据

## 技术栈

- **后端**: Golang
- **前端**: React + Vite + Tailwind CSS
- **数据库**: PostgreSQL
- **认证**: JWT
- **通讯**: WebSocket
- **核心**: Xray-core (作为库直接引入)

## 项目结构

```
xray-panel/
├── cmd/
│   ├── master/          # Master 节点入口
│   └── slave/           # Slave 节点入口
├── internal/
│   ├── xray/            # Xray 实例管理
│   ├── comm/            # WebSocket 通讯协议
│   ├── handler/         # HTTP API 处理器
│   └── model/           # PostgreSQL 数据模型
├── web/                 # 前端项目（React + Vite）
├── scripts/
│   ├── init_db.sh       # 数据库初始化
│   └── simulate_traffic.sh  # 流量模拟测试
├── migrations/          # 数据库迁移脚本
├── .env                 # 配置文件
├── build.sh            # 一键编译脚本
└── start.sh            # 一键启动脚本
```

## 快速开始

### 1. 配置环境

编辑 `.env` 文件，设置 Master 地址和数据库连接：

```bash
# Master 配置
MASTER_HOST=your-domain.com  # 或 IP 地址
MASTER_PORT=9091

# 数据库连接
DB_DSN=postgres://xray_admin:xray123456@localhost:5432/xray_panel?sslmode=disable
```

### 2. 初始化数据库

```bash
cd scripts
bash init_db.sh
```

### 3. 编译项目

```bash
bash build.sh
```

### 4. 启动服务

```bash
bash start.sh
```

服务启动后访问：`http://localhost:9091`

### 5. 添加 Slave 节点

1. 在前端界面添加 Slave（只需输入名称）
2. 复制生成的安装命令
3. 在 Slave 服务器上执行命令
4. Slave 会自动连接并上报 IP 地址

## 测试流量统计

#### 快速测试（5 分钟）

1. **启动 Slave（使用 stats 配置）**：
```bash
# 使用简化的 SOCKS5 配置
./bin/slave \
  -config config_simple_stats.json \
  -master "ws://localhost:9090/ws" \
  -token "<your-token>"
```

2. **生成测试流量**：
```bash
# 使用 SOCKS5 代理访问网站
curl -x socks5://localhost:10088 https://www.google.com

# 或批量测试
for i in {1..10}; do
    curl -x socks5://localhost:10088 https://httpbin.org/bytes/10240 -o /dev/null
    sleep 1
done
```

3. **查看流量统计**：
```bash
./scripts/test_traffic.sh
```

详细测试指南：
```bash
./scripts/test_xray_stats.sh  # 完整测试步骤和说明
```

参考文档：
- [XRAY_STATS_API.md](XRAY_STATS_API.md) - Stats API 集成说明
- [MONITORING.md](MONITORING.md) - 监控功能完整文档

### 测试配置同步

运行测试脚本：
```bash
chmod +x scripts/test_slave.sh
./scripts/test_slave.sh
```

该脚本会自动：
1. 生成 Slave Token
2. 向数据库添加测试配置增量
3. 显示启动命令

### 运行 Master 节点

1. 安装并配置 PostgreSQL：
```bash
# 运行数据库初始化脚本
chmod +x scripts/init_db.sh
sudo ./scripts/init_db.sh
```

2. 启动 Master 节点：
```bash
go run cmd/master/main.go -db "postgres://xray_admin:xray_password_123@localhost:5432/xray_panel?sslmode=disable"
```

3. 生成 Slave Token：
```bash
curl -X POST "http://localhost:8080/api/token?name=slave-node-1"
```

详细配置说明请参考 [MASTER_SETUP.md](MASTER_SETUP.md)。

## Slave 端功能

Slave 端直接将 `github.com/xtls/xray-core/core` 作为库引入，提供以下功能:

### 核心特性

- ✅ **实例管理**: 创建、启动、停止 Xray 实例
- ✅ **配置加载**: 支持从 JSON 文件加载配置
- ✅ **配置验证**: 验证配置的基本结构
- ✅ **热重载**: 支持动态重新加载配置
- ✅ **并发安全**: 使用互斥锁保护实例状态
- ✅ **动态管理**: 使用 Xray 内部 API 动态添加/删除 Inbound/Outbound
- ✅ **版本持久化**: 本地文件存储配置版本，防止重启后丢失
- ✅ **WebSocket 客户端**: 连接 Master 并接收配置更新
- ✅ **自动同步**: 启动时自动请求配置同步
- ✅ **自动重连**: 连接断开时自动重新连接
- ✅ **流量统计**: 集成 Xray Stats API，实时采集流量数据 ⭐
- ✅ **流量上报**: 每分钟自动聚合上报到 Master ⭐

#### Slave 端动态配置管理

```go
import "github.com/graypaul/xray-panel/internal/xray"

// 创建实例和管理器
instance := xray.NewInstance()
instance.LoadConfigFromJSON(configData)
instance.Start()

manager := xray.NewManager(instance)

// 动态添加 Inbound
inboundConfig := map[string]interface{}{
    "tag": "http-proxy",
    "port": 10810,
    "protocol": "http",
    "settings": map[string]interface{}{},
}
manager.AddInbound("http-proxy", inboundConfig)

// 动态删除 Inbound
manager.RemoveInbound("http-proxy")

// 应用配置增量（自动识别类型）
manager.ApplyConfigDiff("ADD", configMap)
```

#### 版本持久化

```go
import "github.com/graypaul/xray-panel/internal/xray"

// 创建版本存储
versionStore, _ := xray.NewVersionStore("./data/version.json")

// 获取当前版本
version := versionStore.GetVersion()

// 更新版本
versionStore.UpdateVersion(10)
```

#### WebSocket 客户端（Slave 端）

```go
import "github.com/graypaul/xray-panel/internal/comm"

// 创建客户端
client := comm.NewSlaveClient("ws://localhost:9090/ws", token)

// 注册消息处理器
client.RegisterHandler(comm.MessageTypeConfigDiff, func(msg *comm.Message) error {
    // 处理配置增量
    return nil
})

// 连接到 Master
client.Connect()

// 请求同步
client.RequestSync(localVersion
// 停止实例
instance.Stop()
```

## 配置文件

参考 `config.example.json` 了解基本的配置结构。配置文件采用标准的 Xray JSON 格式。

### 基本配置结构

```json
{
  "log": {
    "loglevel": "info"
  },
  "inbounds": [...],
  "outbounds": [...],
  "routing": {...}
}
```

## Master 端功能

Master 端负责管理多个 Slave 节点，提供版本化配置同步机制。

### 核心特性

- ✅ **数据库管理**: PostgreSQL 存储 Slave 信息和配置增量
- ✅ **JWT 认证**: 基于 JWT 的 Slave 身份验证
- ✅ **WebSocket 通讯**: 实时双向通讯
- ✅ **版本同步**: 增量配置分发和版本管理
- ✅ **连接管理**: Hub 模式管理多个客户端连接

### 数据库表结构

#### slaves 表
存储 Slave 节点信息：
- `id`: 主键
- `name`: Slave 名称（唯一）
- `current_version`: 当前配置版本
- `status`: 状态（online/offline/error）
- `last_seen`: 最后在线时间

#### config_diffs 表
存储配置增量记录：
- `id`: 主键
- `slave_id`: 关联的 Slave ID
- `version`: 配置版本号
- `action`: 操作类型（ADD/DEL/UPDATE）
- `content`: JSON 配置内容

### API 端点

- `GET /health`: 健康检查
- `POST /api/token?name=<slave_name>`: 生成 Slave Token
- `WS /ws?token=<jwt_token>`: WebSocket 连接端点

### 同步机制
配置回滚机制
- [ ] 配置快照和备份
- [ ] 用户管理和权限系统
- [ ] Web 管理界面
- [ ] 实时流量统计和上报
- [ ] 健康检查和自我修复
- [ ] 配置模板系统
- [ ] 多 Master 高可用支持更新数据库中 Slave 的版本号

## 开发说明

### internal/xray 包

负责封装 Xray 实例的生命周期管理:

- `instance.go`: 实例的创建、启动、停止、重载
- `config.go`: 配置加载、验证和默认配置生成

### 依赖项

主要依赖:
- `github.com/xtls/xray-core`: Xray 核心库
- `github.com/lib/pq`: PostgreSQL 驱动
- `github.com/golang-jwt/jwt/v5`: JWT 认证
- `github.com/gorilla/websocket`: WebSocket 支持
- `github.com/google/uuid`: UUID 生成

## WebSocket 消息协议

详见 [MASTER_SETUP.md](MASTER_SETUP.md#websocket-消息协议)。

消息类型：
- `auth`: 认证消息
- `sync_request`: 同步请求（Slave -> Master）
- `config_diff`: 配置增量（Master -> Slave）
- `ack`: 确认消息
- `error`: 错误消息
- `ping/pong`: 心跳

## 待实现功能

- [ ] Slave 端 WebSocket 客户端
- [ ] Slave 端配置应用逻辑
- [ ] 用户管理和权限系统
- [ ] Web 管理界面
- [ ] 监控和日志收集
- [ ] 配置模板系统
- [ ] 流量统计

## 许可证

待定
