import { useState, useEffect } from 'react'
import {
  Network,
  Plus,
  Edit,
  Trash2,
  Server,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  Route,
  Scale,
  X
} from 'lucide-react'
import {
  getSlaves,
  getInbounds,
  createInbound,
  updateInbound,
  deleteInbound,
  pushInbounds
} from '../services/api'
import InboundConfigForm from '../components/InboundConfigForm'
import OutboundManagement from '../components/OutboundManagement'
import RoutingManagement from '../components/RoutingManagement'
import BalancerManagement from '../components/BalancerManagement'
import { PROTOCOL_NAMES } from '../utils/xrayProtocols'
import wsClient from '../services/websocket'

export default function NodeManagement() {
  const [slaves, setSlaves] = useState([])
  const [selectedSlave, setSelectedSlave] = useState(null)
  const [inbounds, setInbounds] = useState([])
  const [loading, setLoading] = useState(false)
  const [configFormOpen, setConfigFormOpen] = useState(false)
  const [editingInbound, setEditingInbound] = useState(null)
  const [showPreview, setShowPreview] = useState(null)
  const [copiedTag, setCopiedTag] = useState(null)
  const [filterProtocol, setFilterProtocol] = useState('all')
  const [pushingConfig, setPushingConfig] = useState(false)
  const [syncStatus, setSyncStatus] = useState({}) // { slaveId: { status: 'syncing'|'success'|'error', message: '' } }
  const [activeTab, setActiveTab] = useState('inbound') // 'inbound' | 'outbound' | 'routing' | 'balancer'

  // 加载 Slave 列表
  useEffect(() => {
    fetchSlaves()
  }, [])

  // 当选择 Slave 时加载其 Inbound 配置
  useEffect(() => {
    if (selectedSlave) {
      fetchInbounds(selectedSlave.id)
    }
  }, [selectedSlave])

  // WebSocket 监听配置同步消息
  useEffect(() => {
    const handleConfigSynced = (data) => {
      console.log('[NodeManagement] Config synced:', data)
      
      if (data.slaveId) {
        setSyncStatus(prev => ({
          ...prev,
          [data.slaveId]: {
            status: data.success ? 'success' : 'error',
            message: data.message || (data.success ? '配置同步成功' : '配置同步失败'),
            timestamp: Date.now()
          }
        }))

        // 3秒后清除成功状态
        if (data.success) {
          setTimeout(() => {
            setSyncStatus(prev => {
              const newState = { ...prev }
              delete newState[data.slaveId]
              return newState
            })
          }, 3000)
        }
      }
    }

    wsClient.on('config_synced', handleConfigSynced)

    return () => {
      wsClient.off('config_synced', handleConfigSynced)
    }
  }, [])

  const fetchSlaves = async () => {
    try {
      const response = await getSlaves()
      // 后端返回格式：{ success: true, data: { slaves: [...] } }
      const slaveList = response?.data?.slaves || response?.slaves || []
      setSlaves(slaveList)
      
      // 如果有 Slave，默认选中第一个
      if (slaveList.length > 0 && !selectedSlave) {
        setSelectedSlave(slaveList[0])
      }
    } catch (error) {
      console.error('[NodeManagement] Failed to fetch slaves:', error)
      // 使用模拟数据
      const mockSlaves = [
        { id: 1, name: 'node-01', status: 'online' },
        { id: 2, name: 'node-02', status: 'online' },
        { id: 3, name: 'node-03', status: 'offline' }
      ]
      setSlaves(mockSlaves)
      if (mockSlaves.length > 0 && !selectedSlave) {
        setSelectedSlave(mockSlaves[0])
      }
    }
  }

  const fetchInbounds = async (slaveId) => {
    setLoading(true)
    try {
      const response = await getInbounds(slaveId)
      // 后端返回格式：{ success: true, data: { inbounds: [...] } }
      const data = response?.data || response
      setInbounds(data.inbounds || data || [])
    } catch (error) {
      console.error('[NodeManagement] Failed to fetch inbounds:', error)
      
      // 如果 API 未实现，使用模拟数据
      setInbounds([
        {
          id: 1,
          tag: 'vless-443',
          protocol: 'vless',
          port: 443,
          status: 'active',
          clients: 1,
          lastUpdated: '2026-01-17 20:00:00'
        },
        {
          id: 2,
          tag: 'vmess-8443',
          protocol: 'vmess',
          port: 8443,
          status: 'active',
          clients: 2,
          lastUpdated: '2026-01-17 19:30:00'
        },
        {
          id: 3,
          tag: 'ss-9000',
          protocol: 'shadowsocks',
          port: 9000,
          status: 'active',
          clients: 5,
          lastUpdated: '2026-01-17 18:00:00'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  // 添加新 Inbound
  const handleAddInbound = () => {
    setEditingInbound(null)
    setConfigFormOpen(true)
  }

  // 编辑 Inbound
  const handleEditInbound = (inbound) => {
    setEditingInbound(inbound)
    setConfigFormOpen(true)
  }

  // 删除 Inbound
  const handleDeleteInbound = async (inbound) => {
    if (!window.confirm(`确定要删除 Inbound "${inbound.tag}" 吗？`)) {
      return
    }

    try {
      await deleteInbound(selectedSlave.id, inbound.id)
      console.log('[NodeManagement] Inbound deleted:', inbound.id)
      
      // 刷新列表
      fetchInbounds(selectedSlave.id)
    } catch (error) {
      console.error('[NodeManagement] Delete error:', error)
      alert('删除失败: ' + error.message)
    }
  }

  // 提交配置
  const handleSubmitConfig = async (data) => {
    try {
      console.log('[NodeManagement] Submitting config:', data)
      
      if (editingInbound) {
        await updateInbound(data.slaveId, editingInbound.id, data.config)
      } else {
        await createInbound(data.slaveId, data.config)
      }
      
      // 刷新列表
      await fetchInbounds(data.slaveId)
      
      return { success: true }
    } catch (error) {
      console.error('[NodeManagement] Submit error:', error)
      throw error
    }
  }

  // 复制配置
  const handleCopyTag = (tag) => {
    navigator.clipboard.writeText(tag)
    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 2000)
  }

  // 过滤 Inbound
  const filteredInbounds = filterProtocol === 'all'
    ? inbounds
    : inbounds.filter(inbound => inbound.protocol === filterProtocol)

  // 获取协议统计
  const protocolStats = inbounds.reduce((acc, inbound) => {
    acc[inbound.protocol] = (acc[inbound.protocol] || 0) + 1
    return acc
  }, {})

  // 推送配置到 Slave
  const handlePushConfig = async () => {
    if (!selectedSlave) return

    setPushingConfig(true)
    setSyncStatus(prev => ({
      ...prev,
      [selectedSlave.id]: {
        status: 'syncing',
        message: '正在推送配置...',
        timestamp: Date.now()
      }
    }))

    try {
      // 获取推送前的版本号
      const beforePush = await getSlaves()
      const slaveInfo = beforePush?.data?.slaves?.find(s => s.id === selectedSlave.id)
      const oldVersion = slaveInfo?.current_version || 0
      
      // 发起推送
      const result = await pushInbounds(selectedSlave.id)
      const targetVersion = result?.data?.version || (oldVersion + 1)
      
      console.log('[NodeManagement] Config push initiated:', {
        slaveId: selectedSlave.id,
        oldVersion,
        targetVersion
      })
      
      // 轮询检查同步状态 (最多10秒)
      let attempts = 0
      const maxAttempts = 20 // 10秒 / 0.5秒
      
      const checkSync = async () => {
        attempts++
        
        try {
          const response = await getSlaves()
          const currentSlave = response?.data?.slaves?.find(s => s.id === selectedSlave.id)
          
          if (currentSlave && currentSlave.current_version >= targetVersion) {
            // 同步成功
            setSyncStatus(prev => ({
              ...prev,
              [selectedSlave.id]: {
                status: 'success',
                message: `配置同步成功 (版本: ${currentSlave.current_version})`,
                timestamp: Date.now()
              }
            }))
            
            // 3秒后清除状态
            setTimeout(() => {
              setSyncStatus(prev => {
                const newState = { ...prev }
                delete newState[selectedSlave.id]
                return newState
              })
            }, 3000)
            
            // 刷新 Inbound 列表
            fetchInbounds(selectedSlave.id)
            return
          }
          
          if (attempts < maxAttempts) {
            // 继续轮询
            setTimeout(checkSync, 500)
          } else {
            // 超时
            setSyncStatus(prev => ({
              ...prev,
              [selectedSlave.id]: {
                status: 'error',
                message: '推送超时，请检查 Slave 连接状态',
                timestamp: Date.now()
              }
            }))
          }
        } catch (error) {
          console.error('[NodeManagement] Check sync error:', error)
          if (attempts < maxAttempts) {
            setTimeout(checkSync, 500)
          }
        }
      }
      
      // 开始轮询
      setTimeout(checkSync, 500)
      
    } catch (error) {
      console.error('[NodeManagement] Push config error:', error)
      setSyncStatus(prev => ({
        ...prev,
        [selectedSlave.id]: {
          status: 'error',
          message: error.message || '推送失败',
          timestamp: Date.now()
        }
      }))
    } finally {
      setPushingConfig(false)
    }
  }

  // 获取当前 Slave 的同步状态
  const currentSyncStatus = selectedSlave ? syncStatus[selectedSlave.id] : null

  // Tab 配置
  const tabs = [
    { id: 'inbound', label: 'Inbound', icon: Network, description: '入站连接配置' },
    { id: 'outbound', label: 'Outbound', icon: Settings, description: '出站连接配置' },
    { id: 'routing', label: '路由规则', icon: Route, description: '流量分流配置' },
    { id: 'balancer', label: '负载均衡', icon: Scale, description: '负载均衡配置' }
  ]

  // 渲染 Inbound 内容
  const renderInboundContent = () => {
    return (
      <>
        {/* 协议过滤和统计 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary-400" />
              <span className="text-sm font-medium text-gray-300">协议筛选:</span>
            </div>
            <select
              value={filterProtocol}
              onChange={(e) => setFilterProtocol(e.target.value)}
              className="input py-1 text-sm"
            >
              <option value="all">全部 ({inbounds.length})</option>
              {Object.entries(protocolStats).map(([protocol, count]) => (
                <option key={protocol} value={protocol}>
                  {PROTOCOL_NAMES[protocol] || protocol} ({count})
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleAddInbound} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            添加 Inbound
          </button>
        </div>

        {/* Inbound 列表 */}
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-400 mx-auto mb-2" />
            <p className="text-gray-400">加载中...</p>
          </div>
        ) : filteredInbounds.length === 0 ? (
          <div className="text-center py-12">
            <Network className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">暂无 Inbound 配置</p>
            {selectedSlave && inbounds.length === 0 && (
              <button onClick={handleAddInbound} className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                添加第一个 Inbound
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Tag</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">协议</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">端口</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">客户端数</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">最后更新</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredInbounds.map((inbound) => (
                  <tr key={inbound.id} className="border-b border-dark-700 hover:bg-dark-800 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-primary-400 bg-dark-900 px-2 py-1 rounded">
                          {inbound.tag}
                        </code>
                        <button
                          onClick={() => handleCopyTag(inbound.tag)}
                          className="p-1 hover:bg-dark-700 rounded transition-colors"
                          title="复制 Tag"
                        >
                          {copiedTag === inbound.tag ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge badge-info">
                        {PROTOCOL_NAMES[inbound.protocol] || inbound.protocol}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-mono">
                      {inbound.port}
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge badge-success">运行中</span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {inbound.clients || 0}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {inbound.lastUpdated}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setShowPreview(inbound)}
                          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                          title="查看配置"
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleEditInbound(inbound)}
                          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteInbound(inbound)}
                          className="p-2 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }


  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">节点配置管理</h1>
          <p className="text-gray-400 mt-1">配置 Xray 节点的 Inbound、Outbound、路由规则和负载均衡</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePushConfig}
            disabled={!selectedSlave || pushingConfig}
            className="btn btn-secondary"
          >
            {pushingConfig ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                推送中...
              </>
            ) : (
              <>
                <Server className="w-4 h-4 mr-2" />
                推送配置
              </>
            )}
          </button>
          <button
            onClick={handleAddInbound}
            disabled={!selectedSlave}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加 Inbound
          </button>
        </div>
      </div>

      {/* 同步状态提示 */}
      {currentSyncStatus && (
        <div className={`card ${
          currentSyncStatus.status === 'syncing' ? 'bg-blue-900/10 border-blue-700' :
          currentSyncStatus.status === 'success' ? 'bg-green-900/10 border-green-700' :
          'bg-red-900/10 border-red-700'
        }`}>
          <div className="flex items-center gap-3">
            {currentSyncStatus.status === 'syncing' && (
              <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
            )}
            {currentSyncStatus.status === 'success' && (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
            {currentSyncStatus.status === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                currentSyncStatus.status === 'syncing' ? 'text-blue-400' :
                currentSyncStatus.status === 'success' ? 'text-green-400' :
                'text-red-400'
              }`}>
                {currentSyncStatus.status === 'syncing' && '配置同步中'}
                {currentSyncStatus.status === 'success' && '配置同步成功'}
                {currentSyncStatus.status === 'error' && '配置同步失败'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {currentSyncStatus.message}
              </p>
            </div>
            {currentSyncStatus.status !== 'syncing' && (
              <button
                onClick={() => setSyncStatus(prev => {
                  const newState = { ...prev }
                  delete newState[selectedSlave.id]
                  return newState
                })}
                className="text-gray-400 hover:text-gray-300"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}

      {/* Slave 选择器 */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary-400" />
            <span className="text-sm font-medium text-gray-300">选择 Slave:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {slaves.map((slave) => (
              <button
                key={slave.id}
                onClick={() => setSelectedSlave(slave)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedSlave?.id === slave.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                {slave.name}
                {slave.status === 'offline' && (
                  <span className="ml-2 text-xs opacity-60">(离线)</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={fetchSlaves}
            className="ml-auto p-2 hover:bg-dark-700 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 标签页切换 */}
      {selectedSlave && (
        <div className="card p-0">
          <div className="border-b border-dark-700">
            <div className="flex gap-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:bg-dark-700 hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* 标签页内容 */}
          <div className="p-6">
            {activeTab === 'inbound' && (
              <div>
                {/* Inbound 配置内容 */}
                {renderInboundContent()}
              </div>
            )}
            
            {activeTab === 'outbound' && (
              <OutboundManagement slaveId={selectedSlave.id} />
            )}
            
            {activeTab === 'routing' && (
              <RoutingManagement slaveId={selectedSlave.id} />
            )}
            
            {activeTab === 'balancer' && (
              <BalancerManagement slaveId={selectedSlave.id} />
            )}
          </div>
        </div>
      )}

      {/* 配置表单 Modal */}
      <InboundConfigForm
        isOpen={configFormOpen}
        onClose={() => setConfigFormOpen(false)}
        onSubmit={handleSubmitConfig}
        slaveId={selectedSlave?.id}
        slaveName={selectedSlave?.name}
        initialConfig={editingInbound}
      />

      {/* 配置预览 Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPreview(null)}
          ></div>
          <div className="relative bg-dark-800 rounded-lg shadow-2xl border border-dark-700 w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-800 border-b border-dark-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-100">
                配置预览 - {showPreview.tag}
              </h2>
              <button
                onClick={() => setShowPreview(null)}
                className="p-1 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(showPreview, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
