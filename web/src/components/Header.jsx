import { useState, useEffect } from 'react'
import {
  Menu,
  Bell,
  User,
  LogOut,
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react'
import wsClient from '../services/websocket'

export default function Header({ onToggleSidebar }) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [wsConnected, setWsConnected] = useState(false)
  const [notifications, setNotifications] = useState(3)

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 监听 WebSocket 连接状态
  useEffect(() => {
    // WebSocket 功能目前仅用于 Slave 连接，前端暂时不需要连接
    // 等待后端实现前端专用的 WebSocket 端点后再启用
    // TODO: 实现前端实时更新的 WebSocket 端点
    
    // 临时禁用 WebSocket 连接，使用轮询获取数据
    console.log('[Header] WebSocket disabled for frontend, using polling instead')
    
    /* 
    // 初始连接 WebSocket
    const token = localStorage.getItem('token')
    wsClient.connect('/ws', token)

    const handleConnected = () => {
      console.log('[Header] WebSocket connected')
      setWsConnected(true)
    }

    const handleDisconnected = () => {
      console.log('[Header] WebSocket disconnected')
      setWsConnected(false)
    }

    const handleError = () => {
      console.log('[Header] WebSocket error')
      setWsConnected(false)
    }

    // 注册事件监听
    wsClient.on('connected', handleConnected)
    wsClient.on('disconnected', handleDisconnected)
    wsClient.on('error', handleError)

    // 初始状态检查
    setWsConnected(wsClient.isConnected())

    // 清理函数
    return () => {
      wsClient.off('connected', handleConnected)
      wsClient.off('disconnected', handleDisconnected)
      wsClient.off('error', handleError)
    }
    */
  }, [])

  return (
    <header className="h-16 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-6">
      {/* 左侧 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* 实时时间 */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{currentTime.toLocaleString('zh-CN')}</span>
        </div>
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-4">
        {/* WebSocket 连接状态 */}
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">已连接</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">断开</span>
            </>
          )}
        </div>

        {/* 通知 */}
        <button className="relative p-2 hover:bg-dark-800 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        {/* 用户菜单 */}
        <div className="flex items-center gap-3 pl-4 border-l border-dark-700">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-100">管理员</p>
            <p className="text-xs text-gray-500">admin</p>
          </div>
          <button className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <User className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-red-900/20 text-red-400 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
