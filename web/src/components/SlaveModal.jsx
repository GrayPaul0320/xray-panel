import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, AlertCircle } from 'lucide-react'
import Modal from './Modal'

/**
 * 添加/编辑 Slave 的表单组件
 * @param {boolean} isOpen - 是否显示
 * @param {Function} onClose - 关闭回调
 * @param {Function} onSubmit - 提交回调
 * @param {Object} slave - 编辑时的 Slave 数据（可选）
 * @param {string} mode - 模式：'add' 或 'edit'
 */
export default function SlaveModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  slave = null,
  mode = 'add'
}) {
  const [formData, setFormData] = useState({
    name: ''
  })
  const [generatedToken, setGeneratedToken] = useState('')
  const [installCommand, setInstallCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [commandCopied, setCommandCopied] = useState(false)

  // 编辑模式时填充数据
  useEffect(() => {
    if (mode === 'edit' && slave) {
      setFormData({
        name: slave.name || ''
      })
    } else {
      setFormData({ name: '' })
      setGeneratedToken('')
      setInstallCommand('')
    }
    setError('')
  }, [slave, mode, isOpen])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // 验证表单
    if (!formData.name.trim()) {
      setError('请输入 Slave 名称')
      return
    }

    setLoading(true)

    try {
      const result = await onSubmit(formData)
      
      console.log('[SlaveModal] API Response:', result)
      
      // 如果是添加模式，显示生成的 Token 和安装命令
      if (mode === 'add' && result && result.token) {
        console.log('[SlaveModal] Setting token and install_command:', {
          token: result.token,
          install_command: result.install_command
        })
        setGeneratedToken(result.token)
        setInstallCommand(result.install_command || '')
      } else {
        // 编辑模式直接关闭
        onClose()
      }
    } catch (err) {
      setError(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyCommand = () => {
    if (installCommand) {
      navigator.clipboard.writeText(installCommand)
      setCommandCopied(true)
      setTimeout(() => setCommandCopied(false), 2000)
    }
  }

  const handleRegenerateToken = async () => {
    if (!slave || !slave.id) return
    
    setLoading(true)
    try {
      // 调用重新生成 Token 的 API
      const result = await onSubmit({ regenerate: true, id: slave.id })
      if (result && result.token) {
        setGeneratedToken(result.token)
      }
    } catch (err) {
      setError(err.message || '重新生成失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ name: '' })
    setGeneratedToken('')
    setInstallCommand('')
    setError('')
    setCopied(false)
    setCommandCopied(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'add' ? '添加 Slave 服务器' : '编辑 Slave 服务器'}
      size="md"
    >
      {/* 如果已生成 Token，显示 Token 界面 */}
      {generatedToken ? (
        <div className="space-y-4">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <p className="text-green-400 font-medium mb-2">✓ Slave 添加成功</p>
            <p className="text-sm text-gray-400">
              请将下方的 JWT Token 配置到 Slave 服务器上
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              JWT Token
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={generatedToken}
                className="input font-mono text-sm resize-none pr-20"
                rows={4}
              />
              <button
                onClick={handleCopyToken}
                className="absolute right-2 top-2 p-2 hover:bg-dark-700 rounded-lg transition-colors"
                title={copied ? '已复制' : '复制 Token'}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              此 Token 仅显示一次，请妥善保存
            </p>
          </div>

          {/* 一键安装命令 */}
          {installCommand && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                一键安装命令
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  value={installCommand}
                  className="input font-mono text-xs resize-none pr-20"
                  rows={8}
                />
                <button
                  onClick={handleCopyCommand}
                  className="absolute right-2 top-2 p-2 hover:bg-dark-700 rounded-lg transition-colors"
                  title={commandCopied ? '已复制' : '复制命令'}
                >
                  {commandCopied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                在 Slave 服务器上以 root 权限执行此脚本：
                <code className="bg-dark-700 px-2 py-1 rounded ml-2">bash install.sh</code>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              className="btn btn-primary flex-1"
            >
              完成
            </button>
          </div>
        </div>
      ) : (
        /* 表单界面 */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Slave 名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Slave 名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如: node-01, us-server-1"
              className="input"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              用于标识此服务器的唯一名称，Slave 连接后将自动上报其 IP 地址
            </p>
          </div>

          {/* 编辑模式下显示重新生成 Token 按钮 */}
          {mode === 'edit' && slave && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
              <p className="text-sm text-yellow-400 mb-2">
                需要重新生成 JWT Token？
              </p>
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={loading}
                className="btn btn-secondary text-sm"
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                重新生成 Token
              </button>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                mode === 'add' ? '添加' : '保存'
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
