import { useState, useEffect } from 'react'
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Layers
} from 'lucide-react'
import {
  getInbounds,
  createInbound,
  updateInbound,
  deleteInbound
} from '../services/api'
import InboundConfigForm from './InboundConfigForm'
import { PROTOCOL_NAMES } from '../utils/xrayProtocols'

export default function InboundManagement({ slaveId }) {
  const [inbounds, setInbounds] = useState([])
  const [loading, setLoading] = useState(false)
  const [configFormOpen, setConfigFormOpen] = useState(false)
  const [editingInbound, setEditingInbound] = useState(null)
  const [showPreview, setShowPreview] = useState(null)
  const [copiedTag, setCopiedTag] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (slaveId) {
      fetchInbounds()
    }
  }, [slaveId])

  const fetchInbounds = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getInbounds(slaveId)
      const inboundList = response?.data?.inbounds || response?.inbounds || []
      setInbounds(inboundList)
    } catch (err) {
      console.error('[InboundManagement] Failed to fetch inbounds:', err)
      setError('获取入站配置失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddInbound = () => {
    setEditingInbound(null)
    setConfigFormOpen(true)
  }

  const handleEditInbound = (inbound) => {
    setEditingInbound(inbound)
    setConfigFormOpen(true)
  }

  const handleDeleteInbound = async (inbound) => {
    if (!confirm(`确定要删除 Inbound "${inbound.tag}" 吗？`)) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      await deleteInbound(slaveId, inbound.id)
      setSuccess(`Inbound "${inbound.tag}" 已删除`)
      setTimeout(() => setSuccess(null), 3000)
      fetchInbounds()
    } catch (err) {
      setError('删除失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleFormSubmit = async (config) => {
    setLoading(true)
    setError(null)
    try {
      if (editingInbound) {
        await updateInbound(slaveId, editingInbound.id, config)
        setSuccess(`Inbound "${config.tag}" 已更新`)
      } else {
        await createInbound(slaveId, config)
        setSuccess(`Inbound "${config.tag}" 已创建`)
      }
      
      setTimeout(() => setSuccess(null), 3000)
      setConfigFormOpen(false)
      fetchInbounds()
    } catch (err) {
      setError((editingInbound ? '更新' : '创建') + '失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }


  const copyToClipboard = (text, tag) => {
    navigator.clipboard.writeText(text)
    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 2000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Layers className="w-6 h-6 text-primary-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">入站配置管理</h3>
            <p className="text-sm text-gray-400">管理 Xray Inbound 代理规则</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchInbounds}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={handleAddInbound}
            disabled={loading}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            添加 Inbound
          </button>
        </div>
      </div>

      {/* 错误/成功提示 */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
            <span className="text-red-400">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
            <span className="text-green-400">{success}</span>
          </div>
        </div>
      )}

      {/* Inbound 列表 */}
      {loading && inbounds.length === 0 ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">加载中...</p>
        </div>
      ) : inbounds.length === 0 ? (
        <div className="text-center py-12 bg-dark-700/30 rounded-lg border border-dark-700">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">暂无入站配置</p>
          <p className="text-gray-500 text-sm">点击上方"添加 Inbound"按钮创建第一个配置</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 text-gray-300 font-medium">Tag</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">协议</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">端口</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">监听地址</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">状态</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">更新时间</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {inbounds.map((inbound) => (
                <tr key={inbound.id} className="border-b border-dark-700/50 hover:bg-dark-700/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <strong className="text-white font-mono">{inbound.tag}</strong>
                      <button
                        onClick={() => copyToClipboard(inbound.tag, inbound.tag)}
                        className="p-1 hover:bg-dark-600 rounded"
                        title="复制 Tag"
                      >
                        {copiedTag === inbound.tag ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs font-medium">
                      {PROTOCOL_NAMES[inbound.protocol] || inbound.protocol}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-white font-mono">
                    {inbound.config?.port || inbound.port || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm font-mono">
                    {inbound.config?.listen || inbound.listen || '0.0.0.0'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      inbound.status === 'active'
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-gray-600/20 text-gray-400'
                    }`}>
                      {inbound.status === 'active' ? '激活' : '未激活'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">
                    {formatDate(inbound.last_updated || inbound.lastUpdated)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowPreview(inbound)}
                        className="p-2 hover:bg-dark-600 rounded text-gray-400 hover:text-white"
                        title="查看配置"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditInbound(inbound)}
                        className="p-2 hover:bg-blue-600/20 rounded text-blue-400"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInbound(inbound)}
                        className="p-2 hover:bg-red-600/20 rounded text-red-400"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 配置表单 Modal */}
      <InboundConfigForm
        isOpen={configFormOpen}
        onClose={() => {
          setConfigFormOpen(false)
          setEditingInbound(null)
        }}
        onSubmit={handleFormSubmit}
        slaveId={slaveId}
        initialConfig={editingInbound?.config}
      />

      {/* 配置预览 Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center sticky top-0 bg-dark-800">
              <h3 className="text-xl font-semibold text-white">
                配置预览: {showPreview.tag}
              </h3>
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 hover:bg-dark-700 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <pre className="bg-dark-900 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="text-gray-300">
                  {JSON.stringify(showPreview.config, null, 2)}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
