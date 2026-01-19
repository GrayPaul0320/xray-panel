import { useState } from 'react'
import { Copy, Check, Terminal, AlertCircle } from 'lucide-react'
import Modal from './Modal'

/**
 * 显示安装命令的 Modal
 * @param {boolean} isOpen - 是否显示
 * @param {Function} onClose - 关闭回调
 * @param {Object} slave - Slave 数据
 * @param {string} token - JWT Token
 * @param {string} installCommand - 安装命令
 */
export default function InstallCommandModal({ 
  isOpen, 
  onClose, 
  slave,
  token,
  installCommand
}) {
  const [tokenCopied, setTokenCopied] = useState(false)
  const [commandCopied, setCommandCopied] = useState(false)

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  const handleCopyCommand = () => {
    if (installCommand) {
      navigator.clipboard.writeText(installCommand)
      setCommandCopied(true)
      setTimeout(() => setCommandCopied(false), 2000)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${slave?.name || 'Slave'} - 安装信息`}
      size="lg"
    >
      <div className="space-y-4">
        {/* 警告提示 */}
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-400">
            <p className="font-medium mb-1">安全提示</p>
            <p>Token 是敏感信息，请妥善保管，不要泄露给他人。如果怀疑 Token 泄露，请立即重新生成。</p>
          </div>
        </div>

        {/* JWT Token */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            JWT Token
          </label>
          <div className="relative">
            <textarea
              readOnly
              value={token || '请先重新生成 Token'}
              className="input font-mono text-sm resize-none pr-20"
              rows={4}
            />
            <button
              onClick={handleCopyToken}
              disabled={!token}
              className="absolute right-2 top-2 p-2 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={tokenCopied ? '已复制' : '复制 Token'}
            >
              {tokenCopied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* 一键安装命令 */}
        {installCommand && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              一键安装命令
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={installCommand}
                className="input font-mono text-xs resize-none pr-20"
                rows={10}
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
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500">
                在 Slave 服务器上执行以下步骤：
              </p>
              <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1 ml-2">
                <li>将上述命令保存为 <code className="bg-dark-700 px-1 py-0.5 rounded">install.sh</code></li>
                <li>添加执行权限：<code className="bg-dark-700 px-1 py-0.5 rounded">chmod +x install.sh</code></li>
                <li>以 root 权限执行：<code className="bg-dark-700 px-1 py-0.5 rounded">sudo bash install.sh</code></li>
              </ol>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="btn btn-primary flex-1"
          >
            关闭
          </button>
        </div>
      </div>
    </Modal>
  )
}
