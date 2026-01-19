import { useState } from 'react'
import { RefreshCw, HelpCircle, AlertCircle } from 'lucide-react'
import { generateUUID, generatePassword } from '../utils/xrayProtocols'
import { validateField } from '../utils/validators'

/**
 * 动态表单字段组件
 * 根据字段定义渲染不同类型的输入控件
 */
export default function FormField({ field, value, onChange, formData }) {
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  const handleGenerate = () => {
    let newValue
    if (field.generator === 'uuid') {
      newValue = generateUUID()
    } else if (field.generator === 'password') {
      newValue = generatePassword(32)
    }
    onChange(newValue)
    // 生成后立即验证
    validateValue(newValue)
  }

  const validateValue = (val) => {
    const result = validateField(field, val)
    if (!result.valid) {
      setError(result.message)
      return false
    }
    setError('')
    return true
  }

  const handleBlur = () => {
    setTouched(true)
    validateValue(value)
  }

  const handleChange = (newValue) => {
    onChange(newValue)
    // 如果已经 touched，实时验证
    if (touched) {
      validateValue(newValue)
    }
  }

  const renderInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <div className="relative">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              placeholder={field.placeholder}
              className={`input ${field.generator ? 'pr-10' : ''} ${error && touched ? 'border-red-500 focus:ring-red-500' : ''}`}
              required={field.required}
            />
            {field.generator && (
              <button
                type="button"
                onClick={handleGenerate}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-dark-700 rounded-lg transition-colors"
                title="生成"
              >
                <RefreshCw className="w-4 h-4 text-primary-400" />
              </button>
            )}
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(parseInt(e.target.value) || '')}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            className={`input ${error && touched ? 'border-red-500 focus:ring-red-500' : ''}`}
            required={field.required}
            min={field.min}
            max={field.max}
          />
        )

      case 'select':
        return (
          <select
            value={value || field.default || ''}
            onChange={(e) => onChange(e.target.value)}
            className="input"
            required={field.required}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(value || []).includes(option.value)}
                  onChange={(e) => {
                    const newValue = value || []
                    if (e.target.checked) {
                      onChange([...newValue, option.value])
                    } else {
                      onChange(newValue.filter(v => v !== option.value))
                    }
                  }}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                />
                <span className="text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        )

      case 'switch':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={value ?? field.default ?? false}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </div>
            <span className="text-sm text-gray-400">
              {value ?? field.default ? '已启用' : '已禁用'}
            </span>
          </label>
        )

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input resize-y min-h-[80px]"
            required={field.required}
            rows={field.rows || 3}
          />
        )

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input"
            required={field.required}
          />
        )
    }
  }

  return (
    <div className="space-y-2">
      {/* 标签 */}
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-300">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {field.help && (
          <button
            type="button"
            onMouseEnter={() => setShowHelp(true)}
            onMouseLeave={() => setShowHelp(false)}
            className="relative"
          >
            <HelpCircle className="w-4 h-4 text-gray-500 hover:text-gray-400" />
            {showHelp && (
              <div className="absolute left-0 top-6 z-10 w-64 p-3 bg-dark-700 border border-dark-600 rounded-lg shadow-xl text-xs text-gray-300">
                {field.help}
              </div>
            )}
          </button>
        )}
      </div>

      {/* 输入控件 */}
      {renderInput()}

      {/* 错误提示 */}
      {error && touched && (
        <div className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}

      {/* 默认值提示 */}
      {!error && field.default !== undefined && field.type !== 'switch' && (
        <p className="text-xs text-gray-500">
          默认值: {JSON.stringify(field.default)}
        </p>
      )}
    </div>
  )
}
