import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-100">系统设置</h1>
        <p className="text-gray-400 mt-1">系统配置与 JWT 密钥管理</p>
      </div>

      <div className="card">
        <div className="text-center py-12">
          <SettingsIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-xl text-gray-400 mb-2">系统设置功能</p>
          <p className="text-sm text-gray-500">此功能将在下一阶段实现</p>
        </div>
      </div>
    </div>
  )
}
