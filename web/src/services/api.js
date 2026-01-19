import axios from 'axios'

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加 JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      
      // 401 未授权 - 跳转登录
      if (status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      
      // 返回错误信息
      return Promise.reject({
        status,
        message: data.error || data.message || '请求失败'
      })
    }
    
    return Promise.reject({
      status: 0,
      message: error.message || '网络错误'
    })
  }
)

// ============== Slave 管理 API ==============

/**
 * 获取所有 Slave 列表
 */
export const getSlaves = () => {
  return api.get('/slaves')
}

/**
 * 获取单个 Slave 详情
 * @param {number} id - Slave ID
 */
export const getSlave = (id) => {
  return api.get(`/slaves/${id}`)
}

/**
 * 添加新 Slave
 * @param {Object} data - { name: string, ip: string }
 * @returns {Promise} - { id, name, ip, token }
 */
export const createSlave = (data) => {
  return api.post('/slaves', data)
}

/**
 * 更新 Slave 信息
 * @param {number} id - Slave ID
 * @param {Object} data - { name: string, ip: string }
 */
export const updateSlave = (id, data) => {
  return api.put(`/slaves/${id}`, data)
}

/**
 * 删除 Slave
 * @param {number} id - Slave ID
 */
export const deleteSlave = (id) => {
  return api.delete(`/slaves/${id}`)
}

/**
 * 重新生成 Slave Token
 * @param {number} id - Slave ID
 * @returns {Promise} - { token }
 */
export const regenerateSlaveToken = (id) => {
  return api.post(`/slaves/${id}/regenerate-token`)
}

// ============== Inbound 配置管理 API ==============

/**
 * 获取指定 Slave 的所有 Inbound 配置
 * @param {number} slaveId - Slave ID
 */
export const getInbounds = (slaveId) => {
  return api.get(`/slaves/${slaveId}/inbounds`)
}

/**
 * 获取单个 Inbound 配置详情
 * @param {number} slaveId - Slave ID
 * @param {number} inboundId - Inbound ID
 */
export const getInbound = (slaveId, inboundId) => {
  return api.get(`/slaves/${slaveId}/inbounds/${inboundId}`)
}

/**
 * 创建新的 Inbound 配置并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {Object} config - Inbound 配置对象
 * @returns {Promise} - { id, tag, message }
 */
export const createInbound = (slaveId, config) => {
  return api.post(`/slaves/${slaveId}/inbounds`, config)
}

/**
 * 更新 Inbound 配置并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {number} inboundId - Inbound ID
 * @param {Object} config - 更新的配置对象
 */
export const updateInbound = (slaveId, inboundId, config) => {
  return api.put(`/slaves/${slaveId}/inbounds/${inboundId}`, config)
}

/**
 * 删除 Inbound 配置
 * @param {number} slaveId - Slave ID
 * @param {number} inboundId - Inbound ID
 */
export const deleteInbound = (slaveId, inboundId) => {
  return api.delete(`/slaves/${slaveId}/inbounds/${inboundId}`)
}

/**
 * 批量推送配置到 Slave
 * @param {number} slaveId - Slave ID
 * @param {Array} inboundIds - Inbound ID 数组
 */
export const pushInbounds = (slaveId, inboundIds) => {
  return api.post(`/slaves/${slaveId}/inbounds/push`, { inbound_ids: inboundIds })
}

/**
 * 同步 Slave 配置（重启 Xray）
 * @param {number} slaveId - Slave ID
 */
export const syncSlaveConfig = (slaveId) => {
  return api.post(`/slaves/${slaveId}/sync`)
}

// ============== Outbound 配置管理 API ==============

/**
 * 获取指定 Slave 的所有 Outbound 配置
 * @param {number} slaveId - Slave ID
 */
export const getOutbounds = (slaveId) => {
  return api.get(`/slaves/${slaveId}/outbounds`)
}

/**
 * 获取单个 Outbound 配置详情
 * @param {number} slaveId - Slave ID
 * @param {number} outboundId - Outbound ID
 */
export const getOutbound = (slaveId, outboundId) => {
  return api.get(`/slaves/${slaveId}/outbounds/${outboundId}`)
}

/**
 * 创建新的 Outbound 配置并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {Object} config - Outbound 配置对象
 * @returns {Promise} - { id, tag, message }
 */
export const createOutbound = (slaveId, config) => {
  return api.post(`/slaves/${slaveId}/outbounds`, config)
}

/**
 * 更新 Outbound 配置并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {number} outboundId - Outbound ID
 * @param {Object} config - 更新的配置对象
 */
export const updateOutbound = (slaveId, outboundId, config) => {
  return api.put(`/slaves/${slaveId}/outbounds/${outboundId}`, config)
}

/**
 * 删除 Outbound 配置
 * @param {number} slaveId - Slave ID
 * @param {number} outboundId - Outbound ID
 */
export const deleteOutbound = (slaveId, outboundId) => {
  return api.delete(`/slaves/${slaveId}/outbounds/${outboundId}`)
}

// ============== Routing 路由规则管理 API ==============

/**
 * 获取指定 Slave 的所有路由规则
 * @param {number} slaveId - Slave ID
 */
export const getRoutingRules = (slaveId) => {
  return api.get(`/slaves/${slaveId}/routing`)
}

/**
 * 获取单个路由规则详情
 * @param {number} slaveId - Slave ID
 * @param {number} ruleId - Rule ID
 */
export const getRoutingRule = (slaveId, ruleId) => {
  return api.get(`/slaves/${slaveId}/routing/${ruleId}`)
}

/**
 * 创建新的路由规则并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {Object} rule - 路由规则对象
 * @returns {Promise} - { id, message }
 */
export const createRoutingRule = (slaveId, rule) => {
  return api.post(`/slaves/${slaveId}/routing`, rule)
}

/**
 * 更新路由规则并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {number} ruleId - Rule ID
 * @param {Object} rule - 更新的规则对象
 */
export const updateRoutingRule = (slaveId, ruleId, rule) => {
  return api.put(`/slaves/${slaveId}/routing/${ruleId}`, rule)
}

/**
 * 删除路由规则
 * @param {number} slaveId - Slave ID
 * @param {number} ruleId - Rule ID
 */
export const deleteRoutingRule = (slaveId, ruleId) => {
  return api.delete(`/slaves/${slaveId}/routing/${ruleId}`)
}

// ============== Balancer 负载均衡管理 API ==============

/**
 * 获取指定 Slave 的所有负载均衡器配置
 * @param {number} slaveId - Slave ID
 */
export const getBalancers = (slaveId) => {
  return api.get(`/slaves/${slaveId}/balancers`)
}

/**
 * 获取单个负载均衡器配置详情
 * @param {number} slaveId - Slave ID
 * @param {number} balancerId - Balancer ID
 */
export const getBalancer = (slaveId, balancerId) => {
  return api.get(`/slaves/${slaveId}/balancers/${balancerId}`)
}

/**
 * 创建新的负载均衡器配置并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {Object} config - 负载均衡器配置对象
 * @returns {Promise} - { id, tag, message }
 */
export const createBalancer = (slaveId, config) => {
  return api.post(`/slaves/${slaveId}/balancers`, config)
}

/**
 * 更新负载均衡器配置并推送到 Slave
 * @param {number} slaveId - Slave ID
 * @param {number} balancerId - Balancer ID
 * @param {Object} config - 更新的配置对象
 */
export const updateBalancer = (slaveId, balancerId, config) => {
  return api.put(`/slaves/${slaveId}/balancers/${balancerId}`, config)
}

/**
 * 删除负载均衡器配置
 * @param {number} slaveId - Slave ID
 * @param {number} balancerId - Balancer ID
 */
export const deleteBalancer = (slaveId, balancerId) => {
  return api.delete(`/slaves/${slaveId}/balancers/${balancerId}`)
}

// ============== 流量统计 API ==============

/**
 * 获取所有 Slave 的流量统计
 */
export const getTrafficStats = () => {
  return api.get('/traffic/stats')
}

/**
 * 获取单个 Slave 的流量统计
 * @param {number} slaveId - Slave ID
 */
export const getSlaveTraffic = (slaveId) => {
  return api.get(`/traffic/stats/${slaveId}`)
}

/**
 * 获取指定时间范围的流量统计
 * @param {number} slaveId - Slave ID
 * @param {string} startTime - 开始时间
 * @param {string} endTime - 结束时间
 */
export const getTrafficHistory = (slaveId, startTime, endTime) => {
  return api.get(`/traffic/history/${slaveId}`, {
    params: { start: startTime, end: endTime }
  })
}

// ============== 系统 API ==============

/**
 * 健康检查
 */
export const healthCheck = () => {
  return api.get('/health')
}

/**
 * 获取系统统计
 */
export const getSystemStats = () => {
  return api.get('/stats')
}

/**
 * 获取系统日志
 * @param {number} limit - 日志条数
 */
export const getSystemLogs = (limit = 50) => {
  return api.get('/logs', { params: { limit } })
}

// ============== 认证 API ==============

/**
 * 登录
 * @param {Object} credentials - { username, password }
 * @returns {Promise} - { token }
 */
export const login = (credentials) => {
  return api.post('/login', credentials)
}

/**
 * 登出
 */
export const logout = () => {
  localStorage.removeItem('token')
  return Promise.resolve()
}

/**
 * 验证 Token
 */
export const verifyToken = () => {
  return api.get('/verify')
}

export default api
