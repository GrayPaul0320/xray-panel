import { X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * 通用 Modal 组件
 * @param {boolean} isOpen - 是否显示 Modal
 * @param {Function} onClose - 关闭 Modal 的回调
 * @param {string} title - Modal 标题
 * @param {ReactNode} children - Modal 内容
 * @param {string} size - Modal 尺寸 (sm, md, lg, xl)
 */
export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md'
}) {
  // ESC 键关闭 Modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal 内容 */}
      <div className={`relative bg-dark-800 rounded-lg shadow-2xl border border-dark-700 w-full mx-4 ${sizeClasses[size]}`}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
