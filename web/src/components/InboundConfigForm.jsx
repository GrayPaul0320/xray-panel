import { useState, useEffect } from 'react'
import { X, Save, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import Modal from './Modal'
import FormField from './FormField'
import {
  PROTOCOLS,
  PROTOCOL_NAMES,
  getDefaultConfig,
  getProtocolFields,
  getNestedValue,
  setNestedValue,
  evaluateCondition
} from '../utils/xrayProtocols'

/**
 * Inbound 配置表单组件
 * 动态根据协议类型渲染对应的配置字段
 */
export default function InboundConfigForm({
  isOpen,
  onClose,
  onSubmit,
  slaveId,
  slaveName,
  initialConfig = null
}) {
  const [protocol, setProtocol] = useState(PROTOCOLS.VLESS)
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // 初始化或切换协议时重置表单
  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        // 编辑模式：加载现有配置
        setProtocol(initialConfig.protocol || PROTOCOLS.VLESS)
        setFormData(initialConfig)
      } else {
        // 新增模式：使用默认配置
        const defaultConfig = getDefaultConfig(protocol)
        setFormData(defaultConfig)
      }
      setErrors({})
    }
  }, [isOpen, protocol, initialConfig])

  // 切换协议时重新生成默认配置
  const handleProtocolChange = (newProtocol) => {
    setProtocol(newProtocol)
    const defaultConfig = getDefaultConfig(newProtocol)
    setFormData(defaultConfig)
    setErrors({})
  }

  // 更新表单字段值
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => {
      const newData = { ...prev }
      setNestedValue(newData, fieldName, value)
      return newData
    })

    // 清除该字段的错误
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  // 验证表单
  const validateForm = () => {
    const newErrors = {}
    const fields = getProtocolFields(protocol)

    fields.forEach(field => {
      // 检查条件是否满足
      if (field.condition && !evaluateCondition(field.condition, formData)) {
        return
      }

      const value = getNestedValue(formData, field.name)

      // 必填项验证
      if (field.required && !value) {
        newErrors[field.name] = `${field.label} 不能为空`
      }

      // 正则验证
      if (field.pattern && value) {
        const regex = new RegExp(field.pattern)
        if (!regex.test(value)) {
          newErrors[field.name] = `${field.label} 格式不正确`
        }
      }

      // 数字范围验证
      if (field.type === 'number' && value) {
        const num = parseInt(value)
        if (field.min !== undefined && num < field.min) {
          newErrors[field.name] = `${field.label} 不能小于 ${field.min}`
        }
        if (field.max !== undefined && num > field.max) {
          newErrors[field.name] = `${field.label} 不能大于 ${field.max}`
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        slaveId,
        config: formData
      })
      onClose()
    } catch (error) {
      console.error('[InboundConfigForm] Submit error:', error)
      setErrors({ submit: error.message || '保存失败' })
    } finally {
      setLoading(false)
    }
  }

  // 获取当前协议的字段定义
  const fields = getProtocolFields(protocol)

  // 过滤满足条件的字段
  const visibleFields = fields.filter(field => 
    !field.condition || evaluateCondition(field.condition, formData)
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${initialConfig ? '编辑' : '添加'} Inbound 配置 - ${slaveName || '未选择服务器'}`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 错误提示 */}
        {errors.submit && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{errors.submit}</p>
          </div>
        )}

        {/* 协议选择 */}
        <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            选择协议 <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.values(PROTOCOLS).map((proto) => (
              <button
                key={proto}
                type="button"
                onClick={() => handleProtocolChange(proto)}
                disabled={!!initialConfig}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  protocol === proto
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                } ${initialConfig ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {PROTOCOL_NAMES[proto]}
              </button>
            ))}
          </div>
          {initialConfig && (
            <p className="text-xs text-gray-500 mt-2">
              编辑模式下不能更改协议类型
            </p>
          )}
        </div>

        {/* 动态字段 */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {visibleFields.map((field) => (
            <div key={field.name}>
              <FormField
                field={field}
                value={getNestedValue(formData, field.name)}
                onChange={(value) => handleFieldChange(field.name, value)}
                formData={formData}
              />
              {errors[field.name] && (
                <p className="text-sm text-red-400 mt-1">{errors[field.name]}</p>
              )}
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4 border-t border-dark-700">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="btn btn-secondary"
          >
            <Eye className="w-4 h-4 mr-2" />
            预览配置
          </button>
          <div className="flex-1"></div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存并推送
              </>
            )}
          </button>
        </div>
      </form>

      {/* 配置预览 Modal */}
      {showPreview && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="配置预览"
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
              <pre className="text-sm text-gray-300 overflow-x-auto">
                {JSON.stringify(formData, null, 2)}
              </pre>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="btn btn-primary w-full"
            >
              关闭
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
