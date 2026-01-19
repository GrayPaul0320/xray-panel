/**
 * WebSocket 客户端管理
 * 用于实时接收后端推送的 Slave 状态、流量数据等
 */

class WebSocketClient {
  constructor() {
    this.ws = null
    this.url = null
    this.reconnectInterval = 3000 // 重连间隔（毫秒）
    this.maxReconnectAttempts = 10 // 最大重连次数
    this.reconnectAttempts = 0
    this.reconnectTimer = null
    this.heartbeatInterval = 30000 // 心跳间隔（30秒）
    this.heartbeatTimer = null
    this.listeners = new Map() // 事件监听器
    this.isManualClose = false // 是否手动关闭
  }

  /**
   * 连接 WebSocket
   * @param {string} url - WebSocket URL（默认 /ws）
   * @param {string} token - JWT Token
   */
  connect(url = '/ws', token = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected')
      return
    }

    this.isManualClose = false
    
    // 构建完整 URL - 在开发环境中使用相对路径让 Vite 代理处理
    // 在生产环境中使用绝对路径
    let wsUrl = url
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      // 开发环境：localhost:3000 -> 使用代理，直接用相对路径不行，需要手动构建到实际后端
      // 但实际上应该让代理处理，所以检查是否是开发环境
      if (import.meta.env.DEV) {
        // 开发环境：使用后端实际地址（从 Vite 配置的代理 target）
        wsUrl = `ws://localhost:9091${url}`
      } else {
        // 生产环境：使用当前域名
        wsUrl = `${protocol}//${host}${url}`
      }
    }
    this.url = wsUrl
    
    // 添加 Token 参数
    if (token) {
      this.url += `?token=${token}`
    }

    try {
      console.log('[WS] Connecting to:', this.url)
      this.ws = new WebSocket(this.url)
      
      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onerror = this.handleError.bind(this)
      this.ws.onclose = this.handleClose.bind(this)
    } catch (error) {
      console.error('[WS] Connection error:', error)
      this.scheduleReconnect()
    }
  }

  /**
   * 连接成功
   */
  handleOpen(event) {
    console.log('[WS] Connected successfully')
    this.reconnectAttempts = 0
    this.startHeartbeat()
    this.emit('connected', { event })
  }

  /**
   * 接收消息
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data)
      console.log('[WS] Received:', data)
      
      // 根据消息类型分发事件
      const { type, payload } = data
      
      switch (type) {
        case 'pong':
          // 心跳响应
          break
          
        case 'slave_status':
          // Slave 状态变更
          this.emit('slave_status', payload)
          break
          
        case 'traffic_update':
          // 流量更新
          this.emit('traffic_update', payload)
          break
          
        case 'slave_connected':
          // Slave 上线
          this.emit('slave_connected', payload)
          break
          
        case 'slave_disconnected':
          // Slave 下线
          this.emit('slave_disconnected', payload)
          break
          
        case 'config_synced':
          // 配置同步完成
          this.emit('config_synced', payload)
          break
          
        default:
          // 未知消息类型
          this.emit('message', data)
      }
    } catch (error) {
      console.error('[WS] Parse message error:', error)
    }
  }

  /**
   * 连接错误
   */
  handleError(event) {
    console.error('[WS] Error:', event)
    this.emit('error', { event })
  }

  /**
   * 连接关闭
   */
  handleClose(event) {
    console.log('[WS] Connection closed:', event.code, event.reason)
    this.stopHeartbeat()
    this.emit('disconnected', { event })
    
    // 如果不是手动关闭，则尝试重连
    if (!this.isManualClose) {
      this.scheduleReconnect()
    }
  }

  /**
   * 发送消息
   * @param {Object} data - 要发送的数据
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
      return true
    }
    console.warn('[WS] Not connected, cannot send message')
    return false
  }

  /**
   * 关闭连接
   */
  close() {
    this.isManualClose = true
    this.stopHeartbeat()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    console.log('[WS] Connection closed manually')
  }

  /**
   * 计划重连
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached')
      this.emit('reconnect_failed')
      return
    }
    
    this.reconnectAttempts++
    console.log(`[WS] Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.url.split('?')[0], this.getTokenFromUrl())
    }, this.reconnectInterval)
  }

  /**
   * 从 URL 中提取 Token
   */
  getTokenFromUrl() {
    if (!this.url) return null
    const match = this.url.match(/token=([^&]+)/)
    return match ? match[1] : null
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, this.heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 监听事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return
    
    const callbacks = this.listeners.get(event)
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`[WS] Event handler error (${event}):`, error)
      }
    })
  }

  /**
   * 获取连接状态
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * 获取连接状态文本
   */
  getState() {
    if (!this.ws) return 'CLOSED'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING'
      case WebSocket.OPEN:
        return 'OPEN'
      case WebSocket.CLOSING:
        return 'CLOSING'
      case WebSocket.CLOSED:
        return 'CLOSED'
      default:
        return 'UNKNOWN'
    }
  }
}

// 创建单例实例
const wsClient = new WebSocketClient()

export default wsClient
