import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Server,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  Settings,
  Layers,
  Route as RouteIcon,
  Scale,
  Database,
  Clock,
  Key,
  Terminal
} from 'lucide-react'
import { getSlaves, pushInbounds, regenerateSlaveToken } from '../services/api'
import InboundManagement from '../components/InboundManagement'
import OutboundManagement from '../components/OutboundManagement'
import RoutingManagement from '../components/RoutingManagement'
import BalancerManagement from '../components/BalancerManagement'
import InstallCommandModal from '../components/InstallCommandModal'
import wsClient from '../services/websocket'

export default function SlaveDetail() {
  const { slaveId } = useParams()
  const navigate = useNavigate()
  const [slave, setSlave] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('inbound') // 'inbound' | 'outbound' | 'routing' | 'balancer'
  const [inbounds, setInbounds] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [pushingConfig, setPushingConfig] = useState(false)
  const [installModalOpen, setInstallModalOpen] = useState(false)
  const [installToken, setInstallToken] = useState('')
  const [installCommand, setInstallCommand] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  // 加载 Slave 详情
  useEffect(() => {
    fetchSlaveDetail()
  }, [slaveId])

  // 监听 WebSocket 状态更新
  useEffect(() => {
    const handleSlaveStatus = (data) => {
      if (data.slave_id === parseInt(slaveId)) {
        setSlave(prev => prev ? { ...prev, ...data } : null)
      }
    }

    const handleConfigSynced = (data) => {
      if (data.slaveId === parseInt(slaveId)) {
        setSyncStatus({
          status: data.success ? 'success' : 'error',
          message: data.message || (data.success ? '配置同步成功' : '配置同步失败'),
          timestamp: Date.now()
        })

        setTimeout(() => setSyncStatus(null), 3000)
      }
    }

    wsClient.on('slave_status', handleSlaveStatus)
    wsClient.on('slave_connected', handleSlaveStatus)
    wsClient.on('slave_disconnected', handleSlaveStatus)
    wsClient.on('config_synced', handleConfigSynced)

    return () => {
      wsClient.off('slave_status', handleSlaveStatus)
      wsClient.off('slave_connected', handleSlaveStatus)
      wsClient.off('slave_disconnected', handleSlaveStatus)
      wsClient.off('config_synced', handleConfigSynced)
    }
  }, [slaveId])

  const fetchSlaveDetail = async () => {
    setLoading(true)
    try {
      const response = await getSlaves()
      const slaveList = response?.data?.slaves || response?.slaves || []
      const foundSlave = slaveList.find(s => s.id === parseInt(slaveId))
      
      if (foundSlave) {
        setSlave(foundSlave)
      } else {
        console.error('[SlaveDetail] Slave not found:', slaveId)
        // 可以跳转回列表或显示404
      }
    } catch (error) {
      console.error('[SlaveDetail] Failed to fetch slave:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '未知'
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (e) {
      return dateStr
    }
  }

  const handlePushConfig = async () => {
    if (!confirm('确定要将所有配置推送到 Slave 吗？')) {
      return
    }

    setPushingConfig(true)
    setSyncStatus(null)
    try {
      await pushInbounds(slaveId)
      setSyncStatus({
        status: 'success',
        message: '配置推送成功',
        timestamp: Date.now()
      })
      setTimeout(() => setSyncStatus(null), 3000)
    } catch (err) {
      setSyncStatus({
        status: 'error',
        message: '推送失败: ' + (err.message || '未知错误'),
        timestamp: Date.now()
      })
    } finally {
      setPushingConfig(false)
    }
  }

  const handleViewInstallInfo = async () => {
    setRegenerating(true)
    try {
      // 重新生成 token 以便查看安装信息
      const data = await regenerateSlaveToken(slaveId)
      setInstallToken(data.token)
      setInstallCommand(data.installCommand)
      setInstallModalOpen(true)
    } catch (err) {
      alert('获取安装信息失败: ' + (err.message || '未知错误'))
    } finally {
      setRegenerating(false)
    }
  }

  const handleRegenerateToken = async () => {
    if (!confirm('重新生成 Token 将使旧的安装命令失效，确定要继续吗？')) {
      return
    }

    setRegenerating(true)
    try {
      const data = await regenerateSlaveToken(slaveId)
      setInstallToken(data.token)
      setInstallCommand(data.installCommand)
    } catch (err) {
      alert('重新生成 Token 失败: ' + (err.message || '未知错误'))
    } finally {
      setRegenerating(false)
    }
  }

  const tabs = [
    { key: 'inbound', label: '入站配置', icon: Layers, description: '管理 Inbound 代理规则' },
    { key: 'outbound', label: '出站配置', icon: Database, description: '管理 Outbound 代理规则' },
    { key: 'routing', label: '路由规则', icon: RouteIcon, description: '配置流量路由策略' },
    { key: 'balancer', label: '负载均衡', icon: Scale, description: '配置负载均衡器' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (!slave) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-300 text-lg mb-4">Slave 服务器不存在</p>
          <button
            onClick={() => navigate('/slaves')}
            className="btn btn-primary"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部导航栏 */}
      <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/slaves')}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary-600/20 rounded-lg">
                <Server className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{slave.name}</h1>
                <p className="text-gray-400 text-sm mt-1">{slave.ip}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleViewInstallInfo}
              disabled={regenerating}
              className="btn btn-secondary"
            >
              {regenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Terminal className="w-4 h-4" />
              )}
              查看安装命令
            </button>
            <button
              onClick={handlePushConfig}
              disabled={pushingConfig || slave.status !== 'online'}
              className="btn btn-secondary"
            >
              <CheckCircle className={`w-4 h-4 ${pushingConfig ? 'animate-spin' : ''}`} />
              推送配置
            </button>
            <button
              onClick={fetchSlaveDetail}
              className="btn btn-secondary"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>

        {/* Slave 状态信息 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-dark-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">运行状态</span>
              {slave.status === 'online' ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                slave.status === 'online' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-white font-semibold">
                {slave.status === 'online' ? '在线' : '离线'}
              </span>
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Xray Core</span>
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                slave.xray_status === 'running' ? 'bg-green-500' : 
                slave.xray_status === 'stopped' ? 'bg-red-500' : 'bg-gray-500'
              }`} />
              <span className="text-white font-semibold">
                {slave.xray_status === 'running' ? '运行中' : 
                 slave.xray_status === 'stopped' ? '已停止' : '未知'}
              </span>
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">配置版本</span>
              <Settings className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-white font-semibold">
              v{slave.current_version || 0}
            </span>
          </div>

          <div className="bg-dark-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">上行流量</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-white font-semibold">
              {formatBytes(slave.uplink)}
            </span>
          </div>

          <div className="bg-dark-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">下行流量</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-white font-semibold">
              {formatBytes(slave.downlink)}
            </span>
          </div>
        </div>

        {/* 最后连接时间 */}
        <div className="mt-4 flex items-center text-sm text-gray-400">
          <Clock className="w-4 h-4 mr-2" />
          最后连接: {formatDate(slave.last_seen)}
        </div>
      </div>

      {/* 同步状态提示 */}
      {syncStatus && (
        <div className={`p-4 rounded-lg border ${
          syncStatus.status === 'success'
            ? 'bg-green-900/20 border-green-500/30'
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <div className="flex items-center">
            {syncStatus.status === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
            )}
            <span className={syncStatus.status === 'success' ? 'text-green-400' : 'text-red-400'}>
              {syncStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Tab 导航 */}
      <div className="bg-dark-800 rounded-lg border border-dark-700">
        <div className="border-b border-dark-700">
          <div className="flex space-x-1 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab 内容 */}
        <div className="p-6">
          {activeTab === 'inbound' && (
            <InboundManagement slaveId={parseInt(slaveId)} />
          )}
          {activeTab === 'outbound' && (
            <OutboundManagement slaveId={parseInt(slaveId)} />
          )}
          {activeTab === 'routing' && (
            <RoutingManagement slaveId={parseInt(slaveId)} />
          )}
          {activeTab === 'balancer' && (
            <BalancerManagement slaveId={parseInt(slaveId)} />
          )}
        </div>
      </div>

      {/* 安装命令 Modal */}
      <InstallCommandModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        token={installToken}
        installCommand={installCommand}
        onRegenerateToken={handleRegenerateToken}
        regenerating={regenerating}
      />
    </div>
  )
}
