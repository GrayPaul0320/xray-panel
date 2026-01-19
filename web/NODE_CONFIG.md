# Xray 节点配置管理 - 技术文档

## 功能概览

完整的 Xray Inbound 动态配置系统，支持多种协议的灵活配置。

### 核心特性

1. **动态表单系统**：根据选择的协议自动渲染对应的配置字段
2. **多协议支持**：VLESS、VMess、Shadowsocks、Trojan、SOCKS、HTTP
3. **智能验证**：字段级验证（必填、格式、范围）
4. **一键生成**：UUID、密码自动生成
5. **配置预览**：实时查看生成的 JSON 配置
6. **条件渲染**：根据其他字段值动态显示/隐藏字段

## 文件结构

```
web/src/
├── utils/
│   └── xrayProtocols.js         # 协议定义和工具函数
├── components/
│   ├── FormField.jsx            # 动态表单字段组件
│   └── InboundConfigForm.jsx    # Inbound 配置表单主组件
└── pages/
    └── NodeManagement.jsx       # 节点管理页面
```

## 协议配置模板

### 1. VLESS 协议

```javascript
{
  tag: 'vless-443',
  port: 443,
  protocol: 'vless',
  listen: '0.0.0.0',
  settings: {
    clients: [{
      id: 'uuid-here',
      flow: 'xtls-rprx-vision',
      email: 'user@example.com'
    }],
    decryption: 'none'
  },
  streamSettings: {
    network: 'tcp',
    security: 'tls',
    tlsSettings: {
      serverName: 'example.com',
      certificates: [{
        certificateFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      }],
      alpn: ['h2', 'http/1.1']
    }
  },
  sniffing: {
    enabled: true,
    destOverride: ['http', 'tls']
  }
}
```

**字段说明**：
- `id`: UUID，用于客户端身份验证
- `flow`: 流控类型，推荐 `xtls-rprx-vision`
- `network`: 传输协议（tcp/ws/grpc/http）
- `security`: 传输层加密（none/tls/reality）

### 2. VMess 协议

```javascript
{
  tag: 'vmess-8443',
  port: 8443,
  protocol: 'vmess',
  settings: {
    clients: [{
      id: 'uuid-here',
      alterId: 0,
      email: 'user@example.com',
      security: 'auto'
    }]
  },
  streamSettings: {
    network: 'tcp'
  },
  sniffing: {
    enabled: true,
    destOverride: ['http', 'tls']
  }
}
```

**字段说明**：
- `alterId`: 额外 ID 数量，推荐设置为 0
- `security`: 加密方式（auto/aes-128-gcm/chacha20-poly1305/none）

### 3. Shadowsocks 协议

```javascript
{
  tag: 'ss-9000',
  port: 9000,
  protocol: 'shadowsocks',
  settings: {
    method: 'aes-256-gcm',
    password: 'strong-password-here',
    network: 'tcp,udp'
  },
  sniffing: {
    enabled: true,
    destOverride: ['http', 'tls']
  }
}
```

**字段说明**：
- `method`: 加密方式（aes-256-gcm/chacha20-poly1305 等）
- `password`: 连接密码
- `network`: 支持的网络协议（tcp/udp/tcp,udp）

### 4. Trojan 协议

```javascript
{
  tag: 'trojan-443',
  port: 443,
  protocol: 'trojan',
  settings: {
    clients: [{
      password: 'strong-password-here',
      email: 'user@example.com'
    }]
  },
  streamSettings: {
    network: 'tcp',
    security: 'tls',
    tlsSettings: {
      serverName: 'example.com',
      certificates: [{
        certificateFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      }],
      alpn: ['http/1.1']
    }
  },
  sniffing: {
    enabled: true,
    destOverride: ['http', 'tls']
  }
}
```

**字段说明**：
- `password`: Trojan 使用密码而非 UUID
- `security`: 必须使用 TLS

## 动态表单系统

### 字段类型

#### 1. text - 文本输入
```javascript
{
  name: 'tag',
  label: '标签 (Tag)',
  type: 'text',
  required: true,
  placeholder: '例如: vless-in',
  pattern: '^[a-zA-Z0-9-_]+$',
  help: '用于标识此 Inbound 的唯一标签'
}
```

#### 2. number - 数字输入
```javascript
{
  name: 'port',
  label: '监听端口',
  type: 'number',
  required: true,
  min: 1,
  max: 65535,
  placeholder: '443'
}
```

#### 3. select - 单选下拉
```javascript
{
  name: 'streamSettings.network',
  label: '传输协议',
  type: 'select',
  options: [
    { value: 'tcp', label: 'TCP' },
    { value: 'ws', label: 'WebSocket' },
    { value: 'grpc', label: 'gRPC' }
  ],
  default: 'tcp'
}
```

#### 4. multiselect - 多选复选框
```javascript
{
  name: 'sniffing.destOverride',
  label: '嗅探类型',
  type: 'multiselect',
  options: [
    { value: 'http', label: 'HTTP' },
    { value: 'tls', label: 'TLS' }
  ],
  default: ['http', 'tls']
}
```

#### 5. switch - 开关
```javascript
{
  name: 'sniffing.enabled',
  label: '启用流量嗅探',
  type: 'switch',
  default: true,
  help: '自动识别 HTTP/TLS 流量'
}
```

#### 6. 带生成器的字段
```javascript
{
  name: 'settings.clients[0].id',
  label: 'UUID',
  type: 'text',
  required: true,
  generator: 'uuid',  // 或 'password'
  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
}
```

### 条件渲染

某些字段只在满足特定条件时显示：

```javascript
{
  name: 'streamSettings.tlsSettings.serverName',
  label: 'SNI (ServerName)',
  type: 'text',
  condition: 'streamSettings.security === "tls"',
  placeholder: 'example.com'
}
```

**条件语法**：
- `字段路径 === "值"` - 等于
- `字段路径 !== "值"` - 不等于

## 工具函数

### generateUUID()
生成符合 UUID v4 标准的随机 UUID。

```javascript
import { generateUUID } from '../utils/xrayProtocols'
const uuid = generateUUID()
// "a1b2c3d4-e5f6-4abc-8def-123456789abc"
```

### generatePassword(length)
生成指定长度的随机密码。

```javascript
import { generatePassword } from '../utils/xrayProtocols'
const password = generatePassword(32)
// "aB3!dE7@gH9#jK2$mN4%pQ6^rS8&tU0*"
```

### getNestedValue(obj, path)
获取嵌套对象的值，支持数组索引。

```javascript
const config = {
  settings: {
    clients: [{ id: 'uuid-123' }]
  }
}
const id = getNestedValue(config, 'settings.clients[0].id')
// "uuid-123"
```

### setNestedValue(obj, path, value)
设置嵌套对象的值，自动创建中间对象。

```javascript
const config = {}
setNestedValue(config, 'settings.clients[0].id', 'new-uuid')
// config = { settings: { clients: [{ id: 'new-uuid' }] } }
```

### evaluateCondition(condition, formData)
评估条件表达式，用于字段显示/隐藏。

```javascript
const formData = { streamSettings: { security: 'tls' } }
const show = evaluateCondition('streamSettings.security === "tls"', formData)
// true
```

## API 接口

### 1. 获取 Inbound 列表
```http
GET /api/slaves/:slaveId/inbounds
```

**响应**：
```json
{
  "inbounds": [
    {
      "id": 1,
      "tag": "vless-443",
      "protocol": "vless",
      "port": 443,
      "status": "active",
      "clients": 1,
      "lastUpdated": "2026-01-17 20:00:00"
    }
  ]
}
```

### 2. 创建 Inbound
```http
POST /api/slaves/:slaveId/inbounds
Content-Type: application/json

{
  "config": {
    "tag": "vless-443",
    "port": 443,
    "protocol": "vless",
    ...
  }
}
```

**响应**：
```json
{
  "id": 1,
  "tag": "vless-443",
  "message": "Inbound 创建成功并已推送到 Slave"
}
```

### 3. 更新 Inbound
```http
PUT /api/slaves/:slaveId/inbounds/:inboundId
Content-Type: application/json

{
  "config": {
    "tag": "vless-443",
    "port": 8443,
    ...
  }
}
```

### 4. 删除 Inbound
```http
DELETE /api/slaves/:slaveId/inbounds/:inboundId
```

### 5. 批量推送配置
```http
POST /api/slaves/:slaveId/inbounds/push
Content-Type: application/json

{
  "inbound_ids": [1, 2, 3]
}
```

## 使用流程

### 添加新 Inbound

```
1. 访问节点管理页面
   ↓
2. 选择目标 Slave
   ↓
3. 点击 "添加 Inbound"
   ↓
4. 选择协议（VLESS/VMess/Shadowsocks 等）
   ↓
5. 填写基础字段（Tag、端口）
   ↓
6. 根据协议填写特定字段
   - VLESS: UUID、流控、TLS 配置
   - VMess: UUID、AlterID
   - Shadowsocks: 加密方式、密码
   ↓
7. 点击生成按钮自动生成 UUID/密码
   ↓
8. （可选）点击 "预览配置" 查看 JSON
   ↓
9. 点击 "保存并推送"
   ↓
10. 配置保存到数据库并推送到 Slave
   ↓
11. Slave 自动重载 Xray 配置
```

### 编辑现有 Inbound

```
1. 在列表中找到要编辑的 Inbound
   ↓
2. 点击编辑按钮
   ↓
3. 表单自动填充现有配置
   ↓
4. 修改需要更改的字段
   ↓
5. 保存并推送
   ↓
6. Slave 自动应用新配置
```

## 验证规则

### Tag 验证
- 必填
- 只能包含字母、数字、连字符、下划线
- 示例：`vless-in`, `vmess-443`, `ss_9000`

### 端口验证
- 必填
- 范围：1-65535
- 数字类型

### UUID 验证
- 必填（VLESS/VMess）
- 格式：`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- 正则：`/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i`

### 密码验证
- 必填（Shadowsocks/Trojan）
- 推荐长度：16-32 字符
- 包含大小写字母、数字、特殊字符

## 性能优化

1. **条件渲染**：只渲染满足条件的字段，减少 DOM 节点
2. **延迟加载**：配置预览 Modal 按需渲染
3. **表单验证**：客户端验证减少无效请求
4. **降级处理**：API 失败时使用模拟数据

## 安全考虑

1. **输入验证**：所有字段都有客户端验证
2. **XSS 防护**：使用 React 自动转义
3. **CSRF 防护**：JWT Token 验证
4. **配置审查**：提交前可预览完整配置

## 扩展协议

要添加新协议支持，需要：

### 1. 在 `xrayProtocols.js` 中添加协议定义

```javascript
export const PROTOCOLS = {
  // ... 现有协议
  NEW_PROTOCOL: 'new_protocol'
}

export const PROTOCOL_NAMES = {
  // ... 现有名称
  [PROTOCOLS.NEW_PROTOCOL]: 'New Protocol'
}
```

### 2. 添加默认配置模板

```javascript
case PROTOCOLS.NEW_PROTOCOL:
  return {
    ...baseConfig,
    settings: {
      // 协议特定配置
    }
  }
```

### 3. 定义字段规则

```javascript
case PROTOCOLS.NEW_PROTOCOL:
  return [
    ...baseFields,
    {
      name: 'settings.customField',
      label: '自定义字段',
      type: 'text',
      required: true
    }
  ]
```

## 故障排查

### 问题 1: 表单字段不显示

**原因**：条件表达式错误或字段定义缺失

**解决**：
1. 检查 `condition` 字段语法
2. 确认父字段值是否符合条件
3. 查看浏览器控制台错误

### 问题 2: UUID 格式验证失败

**原因**：UUID 格式不符合标准

**解决**：
1. 使用内置生成器
2. 确保格式为 `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
3. 所有字母必须小写

### 问题 3: 配置推送失败

**原因**：Slave 离线或配置格式错误

**解决**：
1. 确认 Slave 在线状态
2. 使用 "预览配置" 检查 JSON 格式
3. 查看后端日志

---

**提示**：
- 所有配置修改会立即推送到 Slave
- Slave 会自动重载 Xray 配置（无需手动重启）
- 配置历史会保存在数据库中
- 支持回滚到之前的配置版本（后续功能）
