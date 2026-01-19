# Xray Panel - 前端管理系统

现代化的多服务器 Xray 管理面板，采用暗色主题设计。

## 技术栈

- **框架**: React 18.3.1 + Vite 5.1.4
- **样式**: Tailwind CSS 3.4.1 (暗色主题)
- **图标**: Lucide React 0.344.0
- **图表**: Recharts 2.12.0
- **路由**: React Router DOM 6.22.0
- **HTTP 客户端**: Axios 1.6.7

## 项目结构

```
web/
├── src/
│   ├── components/       # 通用组件
│   │   ├── Layout.jsx    # 布局容器
│   │   ├── Sidebar.jsx   # 侧边导航栏
│   │   └── Header.jsx    # 顶部状态栏
│   ├── pages/            # 页面组件
│   │   ├── Dashboard.jsx        # 仪表盘（系统总览）
│   │   ├── SlaveList.jsx        # Slave 列表管理
│   │   ├── NodeManagement.jsx   # Xray 节点配置
│   │   └── Settings.jsx         # 系统设置
│   ├── App.jsx           # 根组件（路由配置）
│   ├── main.jsx          # 应用入口
│   └── index.css         # 全局样式
├── index.html            # HTML 模板
├── vite.config.js        # Vite 配置（开发服务器 + 代理）
├── tailwind.config.js    # Tailwind 配置（暗色主题）
├── postcss.config.js     # PostCSS 配置
└── package.json          # 依赖管理
```

## 快速开始

### 1. 安装依赖

```bash
cd web
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

开发服务器将运行在 `http://localhost:3000`

### 3. API 代理配置

开发环境中，以下请求会自动代理到后端：
- HTTP 请求: `/api/*` → `http://localhost:9090`
- WebSocket: `/ws` → `ws://localhost:9090`

确保后端 Master 服务运行在 `localhost:9090`

## 可用脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
npm run lint     # ESLint 代码检查
```

## 功能模块

### 1. 仪表盘 (Dashboard)
- 系统总览统计卡片（总节点数、在线/离线节点、活跃连接数）
- 总流量统计（上行/下行）
- 实时系统日志
- 快速操作按钮

### 2. Slave 列表 (SlaveList)
- Slave 节点列表展示
- 状态监控（在线/离线）
- 版本信息展示
- 流量统计（按节点）
- 搜索和刷新功能
- 节点操作（编辑、删除）

### 3. 节点管理 (NodeManagement)
- Xray Inbound 配置管理（待实现）

### 4. 系统设置 (Settings)
- JWT 密钥配置（待实现）
- 系统参数调整（待实现）

## 设计规范

### 暗色主题配置

```javascript
// tailwind.config.js
colors: {
  dark: {
    50: '#f9fafb',
    100: '#f3f4f6',
    // ... 
    900: '#0f1419',
    950: '#0a0d11',
  },
  primary: {
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  }
}
```

### 自定义 CSS 类

- `card`: 卡片容器（带边框和阴影）
- `btn btn-primary`: 主要操作按钮（蓝色）
- `btn btn-secondary`: 次要操作按钮（灰色）
- `btn btn-danger`: 危险操作按钮（红色）
- `input`: 输入框（暗色背景）
- `badge badge-success`: 成功状态徽章（绿色）
- `badge badge-danger`: 错误状态徽章（红色）
- `badge badge-warning`: 警告状态徽章（黄色）
- `badge badge-info`: 信息状态徽章（蓝色）

## API 集成（TODO）

需要实现以下 API 服务：

```javascript
// 示例：API 服务层
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 获取 Slave 列表
export const getSlaves = () => api.get('/slaves')

// 获取流量统计
export const getTrafficStats = (slaveId) => api.get(`/traffic/${slaveId}`)

// WebSocket 连接
const ws = new WebSocket('ws://localhost:3000/ws')
```

## WebSocket 实时更新

WebSocket 连接状态在 Header 组件中展示：
- 绿色圆点：已连接
- 红色圆点：已断开

后续需要实现：
1. 自动重连机制
2. 心跳检测
3. 实时流量数据推送
4. Slave 状态变更通知

## 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可直接部署到静态服务器或集成到 Go 后端。

## 下一步开发

- [ ] 实现完整的 API 服务层
- [ ] 集成 WebSocket 实时数据
- [ ] 添加 Recharts 流量图表
- [ ] 实现节点管理功能（Xray Inbound 配置）
- [ ] 实现系统设置功能（JWT、系统参数）
- [ ] 添加用户认证流程（登录页面）
- [ ] 数据持久化（LocalStorage 缓存）
- [ ] 响应式优化（移动端适配）
- [ ] 错误处理和加载状态

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 许可证

MIT License
