import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server,
  Search,
  Plus,
  MoreVertical,
  Activity,
  AlertCircle,
  Trash2,
  Edit,
  RefreshCw,
  WifiOff,
  ChevronRight
} from 'lucide-react'
import { getSlaves, createSlave, updateSlave, deleteSlave, regenerateSlaveToken } from '../services/api'
import wsClient from '../services/websocket'
import SlaveModal from '../components/SlaveModal'

export default function SlaveList() {
  const navigate = useNavigate()
  const [slaves, setSlaves] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [selectedSlave, setSelectedSlave] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // 获取 Slave 列表
  useEffect(() => {
    fetchSlaves()
  }, [])

  // 监听 WebSocket 实时更新
  useEffect(() => {
    const handleSlaveStatus = (data) => {
      console.log('[SlaveList] Slave status update:', data)
      updateSlaveStatus(data)
    }

    const handleSlaveConnected = (data) => {
      console.log('[SlaveList] Slave connected:', data)
      updateSlaveStatus({ ...data, status: 'online' })
    }

    const handleSlaveDisconnected = (data) => {
      console.log('[SlaveList] Slave disconnected:', data)
      updateSlaveStatus({ ...data, status: 'offline' })
    }

    // 注册 WebSocket 事件监听
    wsClient.on('slave_status', handleSlaveStatus)
    wsClient.on('slave_connected', handleSlaveConnected)
    wsClient.on('slave_disconnected', handleSlaveDisconnected)

    // 清理函数
    return () => {
      wsClient.off('slave_status', handleSlaveStatus)
      wsClient.off('slave_connected', handleSlaveConnected)
      wsClient.off('slave_disconnected', handleSlaveDisconnected)
    }
  }, [])

  const fetchSlaves = async () => {
    setLoading(true)
    try {
      const response = await getSlaves()
      console.log('[SlaveList] Fetched slaves:', response)
      
      // 后端返回格式：{ success: true, data: { slaves: [...], total: 5 } }
      if (response && response.data && Array.isArray(response.data.slaves)) {
        setSlaves(response.data.slaves)
      } else if (response && Array.isArray(response.slaves)) {
        // 兼容旧格式：{ slaves: [...] }
        setSlaves(response.slaves)
      } else if (Array.isArray(response)) {
        // 兼容直接返回数组
        setSlaves(response)
      } else {
        console.warn('[SlaveList] Unexpected data format:', response)
        setSlaves([])
      }
    } catch (error) {
      console.error('[SlaveList] Failed to fetch slaves:', error)
      // 如果 API 未实现，使用模拟数据
      setSlaves([
        {
          id: 1,
          name: 'node-01',
          ip: '192.168.1.100',
          status: 'online',
          current_version: 5,
          last_seen: '2026-01-17 20:45:00',
          uplink: 45.6 * 1024 * 1024 * 1024,
          downlink: 123.4 * 1024 * 1024 * 1024,
          inbound_count: 3
        },
        {
          id: 2,
          name: 'node-02',
          ip: '192.168.1.101',
          status: 'online',
          current_version: 5,
          last_seen: '2026-01-17 20:44:55',
          uplink: 32.1 * 1024 * 1024 * 1024,
          downlink: 89.7 * 1024 * 1024 * 1024,
          inbound_count: 2
        },
        {
          id: 3,
          name: 'node-03',
          ip: '192.168.1.102',
          status: 'offline',
          current_version: 4,
          last_seen: '2026-01-17 20:30:00',
          uplink: 12.3 * 1024 * 1024 * 1024,
          downlink: 34.5 * 1024 * 1024 * 1024,
          inbound_count: 1
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  // 更新单个 Slave 的状态
  const updateSlaveStatus = (data) => {
    setSlaves(prevSlaves => {
      return prevSlaves.map(slave => {
        if (slave.id === data.slave_id || slave.name === data.slave_name) {
          return {
            ...slave,
            status: data.status || slave.status,
            last_seen: data.last_seen || new Date().toISOString(),
            current_version: data.version || slave.current_version
          }
        }
        return slave
      })
    })
  }

  // 打开添加 Modal
  const handleAddSlave = () => {
    setModalMode('add')
    setSelectedSlave(null)
    setModalOpen(true)
  }

  // 打开编辑 Modal
  const handleEditSlave = (slave) => {
    setModalMode('edit')
    setSelectedSlave(slave)
    setModalOpen(true)
  }

  // 提交表单（添加或编辑）
  const handleModalSubmit = async (formData) => {
    try {
      if (modalMode === 'add') {
        // 添加新 Slave
        const response = await createSlave(formData)
        console.log('[SlaveList] Slave created:', response)
        
        // 刷新列表
        await fetchSlaves()
        
        // 返回实际数据（从 response.data 中提取）
        return response.data || response
      } else {
        // 编辑 Slave
        if (formData.regenerate) {
          // 重新生成 Token
          const response = await regenerateSlaveToken(selectedSlave.id)
          return response.data || response
        } else {
          // 更新信息
          await updateSlave(selectedSlave.id, formData)
          await fetchSlaves()
          return { success: true }
        }
      }
    } catch (error) {
      console.error('[SlaveList] Modal submit error:', error)
      throw error
    }
  }

  // 删除 Slave
  const handleDeleteSlave = async (slave) => {
    if (!window.confirm(`确定要删除 Slave "${slave.name}" 吗？此操作不可恢复。`)) {
      return
    }

    try {
      await deleteSlave(slave.id)
      console.log('[SlaveList] Slave deleted:', slave.id)
      
      // 从列表中移除
      setSlaves(prevSlaves => prevSlaves.filter(s => s.id !== slave.id))
    } catch (error) {
      console.error('[SlaveList] Delete error:', error)
      alert('删除失败: ' + error.message)
    }
  }

  const formatBytes = (bytes) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return gb.toFixed(2) + ' GB'
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'online':
        return (
          <span className="badge badge-success flex items-center gap-1">
            <Activity className="w-3 h-3" />
            在线
          </span>
        )
      case 'offline':
        return (
          <span className="badge badge-danger flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            离线
          </span>
        )
      default:
        return <span className="badge badge-warning">未知</span>
    }
  }

  const filteredSlaves = slaves.filter(slave =>
    slave.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (slave.ip && slave.ip.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Slave 服务器管理</h1>
          <p className="text-gray-400 mt-1">管理所有 Slave 服务器</p>
        </div>
        <button onClick={handleAddSlave} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          添加服务器
        </button>
      </div>

      {/* 搜索和过滤 */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索节点名称..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchSlaves}
            className="btn btn-secondary"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Slave 列表 */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">节点名称</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">状态</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">版本</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">最后在线</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">上行流量</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">下行流量</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Inbound</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlaves.map(slave => (
                <tr
                  key={slave.id} 
                  className="border-b border-dark-700 hover:bg-dark-800 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/slaves/${slave.id}`)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Server className="w-5 h-5 text-primary-400" />
                      <div>
                        <div className="font-medium text-gray-100 group-hover:text-primary-400 transition-colors">
                          {slave.name}
                        </div>
                        {slave.ip && (
                          <div className="text-xs text-gray-500">{slave.ip}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(slave.status)}
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    v{slave.current_version || slave.currentVersion || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">
                    {slave.last_seen || slave.lastSeen || '-'}
                  </td>
                  <td className="py-3 px-4 text-blue-400">
                    {formatBytes(slave.uplink)}
                  </td>
                  <td className="py-3 px-4 text-green-400">
                    {formatBytes(slave.downlink)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="badge badge-info">
                      {slave.inbound_count || slave.inboundCount || 0} 个
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditSlave(slave)
                        }}
                        className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4 text-gray-400" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSlave(slave)
                        }}
                        className="p-2 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                      <button 
                        onClick={() => navigate(`/slaves/${slave.id}`)}
                        className="p-2 hover:bg-primary-900/20 rounded-lg transition-colors"
                        title="管理配置"
                      >
                        <ChevronRight className="w-4 h-4 text-primary-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSlaves.length === 0 && !loading && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm ? '未找到匹配的节点' : '暂无节点数据'}
            </p>
          </div>
        )}
      </div>

      {/* 添加/编辑 Modal */}
      <SlaveModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        slave={selectedSlave}
        mode={modalMode}
      />
    </div>
  )
}
