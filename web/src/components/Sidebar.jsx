import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  Network,
  Settings,
  Activity,
  Database
} from 'lucide-react'

export default function Sidebar({ isOpen }) {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: '仪表盘', badge: null },
    { path: '/slaves', icon: Server, label: 'Slave 服务器', badge: null },
    { path: '/settings', icon: Settings, label: '系统设置', badge: null },
  ]

  if (!isOpen) return null

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-dark-700">
        <Activity className="w-8 h-8 text-primary-500 mr-3" />
        <div>
          <h1 className="text-xl font-bold text-gray-100">Xray Panel</h1>
          <p className="text-xs text-gray-500">多服务器管理</p>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="badge badge-info">{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 底部信息 */}
      <div className="p-4 border-t border-dark-700">
        <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg">
          <Database className="w-5 h-5 text-green-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-100 truncate">
              数据库连接
            </p>
            <p className="text-xs text-gray-500">PostgreSQL</p>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </aside>
  )
}
