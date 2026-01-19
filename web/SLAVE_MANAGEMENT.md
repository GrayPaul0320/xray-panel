# Slave 服务器管理页面 - 开发文档

## 功能概览

已完成的 Slave 管理页面功能：

### 1. **Slave 列表展示**
- 表格形式展示所有 Slave 服务器
- 显示信息：
  - Slave 名称 + 公网 IP
  - 在线状态（绿色/红色徽章 + 图标）
  - 当前版本号
  - 最近心跳时间
  - 上行/下行流量统计
  - Inbound 节点数量

### 2. **添加 Slave 功能**
- 点击 "添加节点" 按钮打开弹窗
- 输入字段：
  - Slave 名称（必填）
  - 公网 IP/域名（必填，带格式验证）
- 提交后自动生成 JWT Token
- Token 显示界面：
  - 只读文本框显示完整 Token
  - 一键复制按钮（点击后显示 ✓）
  - 提示："此 Token 仅显示一次，请妥善保存"

### 3. **编辑 Slave 功能**
- 点击编辑按钮打开编辑弹窗
- 可修改名称和 IP
- 提供 "重新生成 Token" 按钮（黄色告警框）
- 重新生成后同样显示新 Token

### 4. **删除 Slave 功能**
- 点击删除按钮弹出确认对话框
- 确认后从列表中移除
- 调用 DELETE API `/api/slaves/{id}`

### 5. **实时状态更新（WebSocket）**
- 自动连接 WebSocket（地址：`/ws`）
- 监听事件：
  - `slave_status`: Slave 状态变更
  - `slave_connected`: Slave 上线
  - `slave_disconnected`: Slave 下线
- 收到消息后实时更新列表中对应 Slave 的状态
- WebSocket 连接状态显示在顶部 Header（绿色/红色圆点）

### 6. **搜索和刷新功能**
- 搜索框：支持按名称或 IP 过滤
- 刷新按钮：手动重新加载列表（带加载动画）

## 文件结构

```
web/src/
├── services/
│   ├── api.js              # API 服务层（axios 封装）
│   └── websocket.js        # WebSocket 客户端（单例模式）
├── components/
│   ├── Modal.jsx           # 通用 Modal 组件
│   ├── SlaveModal.jsx      # 添加/编辑 Slave 表单组件
│   └── Header.jsx          # 顶部栏（含 WebSocket 状态指示）
└── pages/
    └── SlaveList.jsx       # Slave 列表主页面
```

## API 接口说明

### 1. 获取 Slave 列表
```http
GET /api/slaves
```

**响应格式**：
```json
{
  "slaves": [
    {
      "id": 1,
      "name": "node-01",
      "ip": "192.168.1.100",
      "status": "online",
      "current_version": 5,
      "last_seen": "2026-01-17 20:45:00",
      "uplink": 49006354841,
      "downlink": 132565917286,
      "inbound_count": 3
    }
  ]
}
```

### 2. 添加 Slave
```http
POST /api/slaves
Content-Type: application/json

{
  "name": "node-01",
  "ip": "192.168.1.100"
}
```

**响应格式**：
```json
{
  "id": 1,
  "name": "node-01",
  "ip": "192.168.1.100",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. 更新 Slave
```http
PUT /api/slaves/:id
Content-Type: application/json

{
  "name": "node-01-updated",
  "ip": "192.168.1.101"
}
```

### 4. 删除 Slave
```http
DELETE /api/slaves/:id
```

### 5. 重新生成 Token
```http
POST /api/slaves/:id/token
```

**响应格式**：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## WebSocket 消息格式

### 客户端 → 服务端

**心跳消息**：
```json
{
  "type": "ping"
}
```

### 服务端 → 客户端

**Slave 状态变更**：
```json
{
  "type": "slave_status",
  "payload": {
    "slave_id": 1,
    "slave_name": "node-01",
    "status": "online",
    "last_seen": "2026-01-17 20:45:00",
    "version": 5
  }
}
```

**Slave 上线**：
```json
{
  "type": "slave_connected",
  "payload": {
    "slave_id": 1,
    "slave_name": "node-01"
  }
}
```

**Slave 下线**：
```json
{
  "type": "slave_disconnected",
  "payload": {
    "slave_id": 1,
    "slave_name": "node-01"
  }
}
```

## 使用说明

### 1. API 降级处理

如果后端 API 尚未实现，前端会自动使用模拟数据（见 `SlaveList.jsx` 的 `fetchSlaves()` 函数）。

### 2. WebSocket 自动重连

WebSocket 客户端内置自动重连机制：
- 重连间隔：3 秒
- 最大重连次数：10 次
- 连接失败后自动重试

### 3. JWT Token 管理

Token 存储在 `localStorage` 中：
```javascript
localStorage.setItem('token', 'your-jwt-token')
const token = localStorage.getItem('token')
```

所有 API 请求会自动携带 Token（通过 axios 拦截器）。

## 待实现功能

- [ ] 批量操作（批量删除、批量重启）
- [ ] Slave 分组管理
- [ ] 流量图表可视化（Recharts）
- [ ] 导出 Slave 配置
- [ ] Slave 日志查看
- [ ] 告警通知（Slave 离线告警）

## 测试清单

- [x] 添加 Slave（验证 Token 生成和复制）
- [x] 编辑 Slave（修改名称和 IP）
- [x] 删除 Slave（确认对话框）
- [x] 重新生成 Token
- [x] 搜索功能（按名称和 IP）
- [x] WebSocket 连接状态显示
- [x] WebSocket 实时更新（需要后端配合）
- [x] 表单验证（必填项、IP 格式）
- [x] 响应式布局（移动端适配）

## 交互流程

### 添加 Slave 流程

```
1. 用户点击 "添加节点" 按钮
   ↓
2. 打开 SlaveModal（mode: 'add'）
   ↓
3. 用户输入名称和 IP
   ↓
4. 点击 "添加" 按钮
   ↓
5. 调用 API: POST /api/slaves
   ↓
6. 后端返回生成的 JWT Token
   ↓
7. Modal 切换到 Token 显示界面
   ↓
8. 用户点击复制按钮
   ↓
9. 点击 "完成" 关闭 Modal
   ↓
10. 列表自动刷新显示新节点
```

### 实时更新流程

```
1. 页面加载时建立 WebSocket 连接
   ↓
2. Slave 状态变更（如心跳超时）
   ↓
3. 后端推送 WebSocket 消息
   ↓
4. 前端接收消息并解析
   ↓
5. 根据 slave_id 更新对应行的状态
   ↓
6. UI 实时反映变化（在线 → 离线）
```

## 样式说明

### 状态徽章

- **在线**：绿色徽章 `badge-success` + Activity 图标
- **离线**：红色徽章 `badge-danger` + WifiOff 图标
- **未知**：黄色徽章 `badge-warning`

### 操作按钮

- **编辑**：灰色悬停效果 `hover:bg-dark-700`
- **删除**：红色悬停效果 `hover:bg-red-900/20`

### Modal 样式

- 遮罩层：黑色半透明 + 背景模糊
- 内容区：暗色背景 `bg-dark-800` + 边框 `border-dark-700`
- ESC 键关闭
- 点击遮罩关闭
- 阻止背景滚动

## 性能优化

1. **WebSocket 单例模式**：全局共享一个 WebSocket 连接
2. **事件监听器清理**：组件卸载时自动移除监听器
3. **状态更新优化**：只更新变化的 Slave，不重新渲染整个列表
4. **搜索防抖**：实时搜索采用受控组件（无需防抖，已足够快）

## 错误处理

- API 请求失败：显示错误提示
- WebSocket 断开：自动重连 + 状态指示
- 表单验证：实时显示错误信息
- Token 生成失败：在 Modal 中显示错误

---

**注意事项**：

1. 确保后端 Master 服务运行在 `:9090` 端口
2. 后端需要实现对应的 API 端点
3. WebSocket 路径为 `/ws`，需支持 Token 认证（通过 URL 参数 `?token=xxx`）
4. 生产环境中建议使用 HTTPS/WSS
