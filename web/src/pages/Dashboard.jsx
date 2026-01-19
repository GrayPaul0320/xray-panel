import { useState, useEffect, useCallback } from 'react'
import {
  Server,
  Activity,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Calendar,
  BarChart3
} from 'lucide-react'
import { getSystemStats, getTrafficStats } from '../services/api'
import wsClient from '../services/websocket'
import {
  TrafficLineChart,
  TrafficAreaChart,
  SlaveRankingChart,
  NodeRankingChart,
  formatBytes
} from '../components/TrafficCharts'
import { SlaveRankingList, NodeRankingList } from '../components/RankingList'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSlaves: 0,
    onlineSlaves: 0,
    offlineSlaves: 0,
    todayTraffic: { uplink: 0, downlink: 0 },
    monthTraffic: { uplink: 0, downlink: 0 },
    totalTraffic: { uplink: 0, downlink: 0 },
    activeConnections: 0
  })

  const [realtimeData, setRealtimeData] = useState([])
  const [slaveRanking, setSlaveRanking] = useState([])
  const [nodeRanking, setNodeRanking] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // 获取仪表盘数据
  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      // 获取系统统计
      const statsResponse = await getSystemStats()
      console.log('[Dashboard] System stats:', statsResponse)
      
      // 后端返回格式：{ success: true, data: {...} }
      const statsData = statsResponse?.data || statsResponse
      if (statsData) {
        setStats({
          totalSlaves: statsData.totalSlaves || 0,
          onlineSlaves: statsData.onlineSlaves || 0,
          offlineSlaves: statsData.offlineSlaves || 0,
          todayTraffic: statsData.todayTraffic || { uplink: 0, downlink: 0 },
          monthTraffic: statsData.monthTraffic || { uplink: 0, downlink: 0 },
          totalTraffic: statsData.totalTraffic || { uplink: 0, downlink: 0 },
          activeConnections: statsData.activeConnections || 0
        })
      }

      // 获取流量统计
      const trafficResponse = await getTrafficStats()
      console.log('[Dashboard] Traffic stats:', trafficResponse)
      
      // 后端返回格式：{ success: true, data: {...} }
      const trafficData = trafficResponse?.data || trafficResponse
      if (trafficData) {
        // 实时流量数据（最近1小时）
        if (trafficData.realtimeData) {
          setRealtimeData(trafficData.realtimeData)
        }
        
        // Slave 排行
        if (trafficData.slaveRanking) {
          setSlaveRanking(trafficData.slaveRanking)
        }
        
        // 节点排行
        if (trafficData.nodeRanking) {
          setNodeRanking(trafficData.nodeRanking)
        }
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('[Dashboard] Failed to fetch data:', error)
      
      // 使用模拟数据
      loadMockData()
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载模拟数据
  const loadMockData = () => {
    setStats({
      totalSlaves: 12,
      onlineSlaves: 10,
      offlineSlaves: 2,
      todayTraffic: {
        uplink: 1024 * 1024 * 1024 * 15.6,
        downlink: 1024 * 1024 * 1024 * 48.3
      },
      monthTraffic: {
        uplink: 1024 * 1024 * 1024 * 456.7,
        downlink: 1024 * 1024 * 1024 * 1234.5
      },
      totalTraffic: {
        uplink: 1024 * 1024 * 1024 * 2345.6,
        downlink: 1024 * 1024 * 1024 * 8765.4
      },
      activeConnections: 1234
    })

    // 生成模拟的实时数据（最近1小时，每分钟一个点）
    const now = new Date()
    const mockRealtime = []
    for (let i = 60; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 1000)
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
      mockRealtime.push({
        time: timeStr,
        uplink: Math.random() * 10 * 1024 * 1024 + 5 * 1024 * 1024,
        downlink: Math.random() * 30 * 1024 * 1024 + 10 * 1024 * 1024
      })
    }
    setRealtimeData(mockRealtime)

    // Slave 排行
    setSlaveRanking([
      { id: 1, name: 'node-01', total_traffic: 1024 * 1024 * 1024 * 234.5 },
      { id: 2, name: 'node-02', total_traffic: 1024 * 1024 * 1024 * 189.3 },
      { id: 3, name: 'node-03', total_traffic: 1024 * 1024 * 1024 * 156.8 },
      { id: 4, name: 'node-04', total_traffic: 1024 * 1024 * 1024 * 98.2 },
      { id: 5, name: 'node-05', total_traffic: 1024 * 1024 * 1024 * 67.4 }
    ])

    // 节点排行
    setNodeRanking([
      { id: 1, tag: 'vless-443', total_traffic: 1024 * 1024 * 1024 * 123.4 },
      { id: 2, tag: 'vmess-8443', total_traffic: 1024 * 1024 * 1024 * 98.7 },
      { id: 3, tag: 'ss-9000', total_traffic: 1024 * 1024 * 1024 * 87.6 },
      { id: 4, tag: 'trojan-443', total_traffic: 1024 * 1024 * 1024 * 76.5 },
      { id: 5, tag: 'vless-8443', total_traffic: 1024 * 1024 * 1024 * 65.4 },
      { id: 6, tag: 'vmess-443', total_traffic: 1024 * 1024 * 1024 * 54.3 },
      { id: 7, tag: 'ss-8388', total_traffic: 1024 * 1024 * 1024 * 43.2 },
      { id: 8, tag: 'vless-80', total_traffic: 1024 * 1024 * 1024 * 32.1 },
      { id: 9, tag: 'vmess-80', total_traffic: 1024 * 1024 * 1024 * 21.0 },
      { id: 10, tag: 'ss-1080', total_traffic: 1024 * 1024 * 1024 * 10.5 }
    ])

    setRecentLogs([
      { time: '2026-01-17 20:45:00', level: 'info', message: 'Slave [node-01] 心跳正常' },
      { time: '2026-01-17 20:44:55', level: 'success', message: 'Slave [node-02] 配置同步完成' },
      { time: '2026-01-17 20:44:30', level: 'warning', message: 'Slave [node-03] 心跳超时告警' },
      { time: '2026-01-17 20:44:00', level: 'info', message: '流量统计上报 [node-01]: ↑125MB ↓456MB' },
      { time: '2026-01-17 20:43:30', level: 'error', message: 'Slave [node-05] 连接断开' },
    ])
  }

  // 初始加载
  useEffect(() => {
    fetchDashboardData()
    
    // 每30秒刷新一次
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  // 监听 WebSocket 实时更新
  useEffect(() => {
    const handleTrafficUpdate = (data) => {
      console.log('[Dashboard] Traffic update:', data)
      
      // 更新实时图表数据
      setRealtimeData(prev => {
        const newData = [...prev]
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        
        // 添加新数据点
        newData.push({
          time: timeStr,
          uplink: data.uplink || 0,
          downlink: data.downlink || 0
        })
        
        // 保持最近60个数据点（1小时）
        if (newData.length > 60) {
          newData.shift()
        }
        
        return newData
      })
      
      // 更新统计数据
      if (data.stats) {
        setStats(prev => ({
          ...prev,
          ...data.stats
        }))
      }
    }

    wsClient.on('traffic_update', handleTrafficUpdate)
    
    return () => {
      wsClient.off('traffic_update', handleTrafficUpdate)
    }
  }, [])

  const getLevelIcon = (level) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Activity className="w-4 h-4 text-blue-400" />
    }
  }

  // 统计卡片配置
  const statCards = [
    {
      title: '总服务器数',
      value: stats.totalSlaves,
      icon: Server,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      change: '+2',
      changeType: 'up'
    },
    {
      title: '在线服务器',
      value: stats.onlineSlaves,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
      change: '+1',
      changeType: 'up'
    },
    {
      title: '离线服务器',
      value: stats.offlineSlaves,
      icon: XCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-900/20',
      change: '-1',
      changeType: 'down'
    },
    {
      title: '活跃连接',
      value: stats.activeConnections,
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20',
      change: '+56',
      changeType: 'up'
    }
  ]

  // 流量卡片配置
  const trafficCards = [
    {
      title: '今日流量',
      icon: Calendar,
      uplink: stats.todayTraffic.uplink,
      downlink: stats.todayTraffic.downlink,
      color: 'text-blue-400'
    },
    {
      title: '本月流量',
      icon: BarChart3,
      uplink: stats.monthTraffic.uplink,
      downlink: stats.monthTraffic.downlink,
      color: 'text-green-400'
    },
    {
      title: '累计流量',
      icon: TrendingUp,
      uplink: stats.totalTraffic.uplink,
      downlink: stats.totalTraffic.downlink,
      color: 'text-purple-400'
    }
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">系统仪表盘</h1>
          <p className="text-gray-400 mt-1">实时监控多服务器状态与流量统计</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新数据
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <div key={index} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-100">{card.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {card.changeType === 'up' ? (
                      <ArrowUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-xs ${card.changeType === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                      {card.change} 今日
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 流量汇总卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {trafficCards.map((card, index) => {
          const Icon = card.icon
          const total = card.uplink + card.downlink
          return (
            <div key={index} className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg bg-dark-800`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-100">{card.title}</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">总计</span>
                    <span className="text-xl font-bold text-gray-100">
                      {formatBytes(total)}
                    </span>
                  </div>
                  <div className="w-full bg-dark-700 rounded-full h-2">
                    <div className="bg-primary-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dark-700">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">上行</p>
                    <p className="text-sm font-semibold text-blue-400">
                      {formatBytes(card.uplink)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">下行</p>
                    <p className="text-sm font-semibold text-green-400">
                      {formatBytes(card.downlink)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 实时流量图表 */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">实时流量监控</h2>
            <p className="text-sm text-gray-400 mt-1">
              最近 1 小时 · 数据点: {realtimeData.length} · 更新于: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-400">上行</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-400">下行</span>
            </div>
          </div>
        </div>
        <TrafficLineChart data={realtimeData} />
      </div>

      {/* 排行榜 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slave 流量排行 */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-5 h-5 text-primary-400" />
            <h2 className="text-xl font-semibold text-gray-100">Slave 流量排行</h2>
            <span className="text-sm text-gray-500">TOP 5</span>
          </div>
          <SlaveRankingList data={slaveRanking} limit={5} />
        </div>

        {/* 节点流量排行 */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-semibold text-gray-100">节点流量排行</h2>
            <span className="text-sm text-gray-500">TOP 10</span>
          </div>
          <NodeRankingList data={nodeRanking} limit={10} />
        </div>
      </div>

      {/* 系统日志 */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-primary-400" />
          <h2 className="text-xl font-semibold text-gray-100">实时日志</h2>
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {recentLogs.map((log, index) => (
            <div key={index} className="flex items-start gap-3 text-sm">
              {getLevelIcon(log.level)}
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 truncate">{log.message}</p>
                <p className="text-xs text-gray-500 mt-1">{log.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 快速操作 */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn btn-primary">
            <Server className="w-4 h-4 mr-2" />
            添加 Slave 服务器
          </button>
          <button className="btn btn-secondary">
            <Activity className="w-4 h-4 mr-2" />
            查看流量报表
          </button>
          <button className="btn btn-secondary">
            <TrendingUp className="w-4 h-4 mr-2" />
            系统健康检查
          </button>
        </div>
      </div>
    </div>
  )
}
