/**
 * Xray 协议配置模板和工具函数
 */

// 协议类型枚举
export const PROTOCOLS = {
  VLESS: 'vless',
  VMESS: 'vmess',
  SHADOWSOCKS: 'shadowsocks',
  TROJAN: 'trojan',
  SOCKS: 'socks',
  HTTP: 'http'
}

// 协议显示名称
export const PROTOCOL_NAMES = {
  [PROTOCOLS.VLESS]: 'VLESS',
  [PROTOCOLS.VMESS]: 'VMess',
  [PROTOCOLS.SHADOWSOCKS]: 'Shadowsocks',
  [PROTOCOLS.TROJAN]: 'Trojan',
  [PROTOCOLS.SOCKS]: 'SOCKS5',
  [PROTOCOLS.HTTP]: 'HTTP'
}

// 流控类型
export const FLOW_TYPES = {
  NONE: '',
  XTLS_RPRX_VISION: 'xtls-rprx-vision'
}

// Shadowsocks 加密方式
export const SS_CIPHERS = [
  'aes-128-gcm',
  'aes-256-gcm',
  'chacha20-poly1305',
  'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305'
]

// VMess 加密方式
export const VMESS_CIPHERS = [
  'auto',
  'aes-128-gcm',
  'chacha20-poly1305',
  'none'
]

// 网络类型
export const NETWORK_TYPES = {
  TCP: 'tcp',
  KCP: 'kcp',
  WS: 'ws',
  HTTP: 'http',
  QUIC: 'quic',
  GRPC: 'grpc'
}

// TLS 类型
export const TLS_TYPES = {
  NONE: 'none',
  TLS: 'tls',
  REALITY: 'reality'
}

/**
 * 生成默认配置
 */
export const getDefaultConfig = (protocol) => {
  const baseConfig = {
    tag: '',
    port: 443,
    protocol: protocol,
    listen: '0.0.0.0',
    sniffing: {
      enabled: true,
      destOverride: ['http', 'tls']
    }
  }

  switch (protocol) {
    case PROTOCOLS.VLESS:
      return {
        ...baseConfig,
        settings: {
          clients: [{
            id: generateUUID(),
            flow: FLOW_TYPES.XTLS_RPRX_VISION,
            email: ''
          }],
          decryption: 'none'
        },
        streamSettings: {
          network: NETWORK_TYPES.TCP,
          security: TLS_TYPES.TLS,
          tlsSettings: {
            serverName: '',
            certificates: [{
              certificateFile: '/path/to/cert.crt',
              keyFile: '/path/to/key.key'
            }],
            alpn: ['h2', 'http/1.1']
          }
        }
      }

    case PROTOCOLS.VMESS:
      return {
        ...baseConfig,
        settings: {
          clients: [{
            id: generateUUID(),
            alterId: 0,
            email: '',
            security: 'auto'
          }]
        },
        streamSettings: {
          network: NETWORK_TYPES.TCP,
          security: TLS_TYPES.NONE
        }
      }

    case PROTOCOLS.SHADOWSOCKS:
      return {
        ...baseConfig,
        settings: {
          method: 'aes-256-gcm',
          password: generatePassword(16),
          network: 'tcp,udp'
        }
      }

    case PROTOCOLS.TROJAN:
      return {
        ...baseConfig,
        settings: {
          clients: [{
            password: generatePassword(32),
            email: ''
          }]
        },
        streamSettings: {
          network: NETWORK_TYPES.TCP,
          security: TLS_TYPES.TLS,
          tlsSettings: {
            serverName: '',
            certificates: [{
              certificateFile: '/path/to/cert.crt',
              keyFile: '/path/to/key.key'
            }],
            alpn: ['http/1.1']
          }
        }
      }

    case PROTOCOLS.SOCKS:
      return {
        ...baseConfig,
        port: 1080,
        settings: {
          auth: 'noauth',
          udp: true,
          ip: '127.0.0.1'
        }
      }

    case PROTOCOLS.HTTP:
      return {
        ...baseConfig,
        port: 8080,
        settings: {
          timeout: 300,
          allowTransparent: false
        }
      }

    default:
      return baseConfig
  }
}

/**
 * 协议字段定义
 */
export const getProtocolFields = (protocol) => {
  const baseFields = [
    {
      name: 'tag',
      label: '标签 (Tag)',
      type: 'text',
      required: true,
      placeholder: '例如: vless-in, vmess-443',
      help: '用于标识此 Inbound 的唯一标签'
    },
    {
      name: 'port',
      label: '监听端口',
      type: 'number',
      required: true,
      min: 1,
      max: 65535,
      validator: 'port',
      placeholder: '443',
      help: '端口范围: 1-65535'
    },
    {
      name: 'listen',
      label: '监听地址',
      type: 'text',
      default: '0.0.0.0',
      validator: 'ip',
      placeholder: '0.0.0.0',
      help: '通常使用 0.0.0.0 监听所有网卡，支持 IPv4/IPv6'
    }
  ]

  const sniffingFields = [
    {
      name: 'sniffing.enabled',
      label: '启用流量嗅探',
      type: 'switch',
      default: true,
      help: '自动识别 HTTP/TLS 流量'
    },
    {
      name: 'sniffing.destOverride',
      label: '嗅探类型',
      type: 'multiselect',
      options: [
        { value: 'http', label: 'HTTP' },
        { value: 'tls', label: 'TLS' },
        { value: 'quic', label: 'QUIC' }
      ],
      default: ['http', 'tls'],
      condition: 'sniffing.enabled'
    }
  ]

  switch (protocol) {
    case PROTOCOLS.VLESS:
      return [
        ...baseFields,
        {
          name: 'settings.clients[0].id',
          label: 'UUID',
          type: 'text',
          required: true,
          generator: 'uuid',
          validator: 'uuid',
          placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          help: '点击生成按钮自动生成 UUID，格式: 8-4-4-4-12'
        },
        {
          name: 'settings.clients[0].flow',
          label: '流控 (Flow)',
          type: 'select',
          options: [
            { value: '', label: '不使用流控' },
            { value: FLOW_TYPES.XTLS_RPRX_VISION, label: 'xtls-rprx-vision' }
          ],
          default: FLOW_TYPES.XTLS_RPRX_VISION,
          help: '推荐使用 xtls-rprx-vision'
        },
        {
          name: 'settings.clients[0].email',
          label: '用户标识 (Email)',
          type: 'text',
          placeholder: 'user@example.com',
          help: '可选，用于日志标识'
        },
        {
          name: 'streamSettings.network',
          label: '传输协议',
          type: 'select',
          required: true,
          options: [
            { value: NETWORK_TYPES.TCP, label: 'TCP' },
            { value: NETWORK_TYPES.WS, label: 'WebSocket' },
            { value: NETWORK_TYPES.GRPC, label: 'gRPC' },
            { value: NETWORK_TYPES.HTTP, label: 'HTTP/2' }
          ],
          default: NETWORK_TYPES.TCP
        },
        {
          name: 'streamSettings.security',
          label: '传输层安全',
          type: 'select',
          required: true,
          options: [
            { value: TLS_TYPES.NONE, label: '不加密' },
            { value: TLS_TYPES.TLS, label: 'TLS' },
            { value: TLS_TYPES.REALITY, label: 'Reality' }
          ],
          default: TLS_TYPES.TLS
        },
        {
          name: 'streamSettings.tlsSettings.serverName',
          label: 'SNI (ServerName)',
          type: 'text',
          placeholder: 'example.com',
          condition: 'streamSettings.security === "tls"',
          help: '用于 TLS 握手的域名'
        },
        {
          name: 'streamSettings.tlsSettings.certificates[0].certificateFile',
          label: '证书文件路径',
          type: 'text',
          placeholder: '/path/to/cert.crt',
          condition: 'streamSettings.security === "tls"'
        },
        {
          name: 'streamSettings.tlsSettings.certificates[0].keyFile',
          label: '密钥文件路径',
          type: 'text',
          placeholder: '/path/to/key.key',
          condition: 'streamSettings.security === "tls"'
        },
        {
          name: 'streamSettings.wsSettings.path',
          label: 'WebSocket 路径',
          type: 'text',
          placeholder: '/ws',
          condition: 'streamSettings.network === "ws"',
          help: 'WebSocket 握手路径'
        },
        ...sniffingFields
      ]

    case PROTOCOLS.VMESS:
      return [
        ...baseFields,
        {
          name: 'settings.clients[0].id',
          label: 'UUID',
          type: 'text',
          required: true,
          generator: 'uuid',
          placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        },
        {
          name: 'settings.clients[0].alterId',
          label: 'AlterID',
          type: 'number',
          default: 0,
          min: 0,
          max: 65535,
          help: '推荐设置为 0'
        },
        {
          name: 'settings.clients[0].security',
          label: '加密方式',
          type: 'select',
          options: VMESS_CIPHERS.map(c => ({ value: c, label: c })),
          default: 'auto'
        },
        {
          name: 'settings.clients[0].email',
          label: '用户标识 (Email)',
          type: 'text',
          placeholder: 'user@example.com'
        },
        {
          name: 'streamSettings.network',
          label: '传输协议',
          type: 'select',
          options: [
            { value: NETWORK_TYPES.TCP, label: 'TCP' },
            { value: NETWORK_TYPES.WS, label: 'WebSocket' },
            { value: NETWORK_TYPES.HTTP, label: 'HTTP/2' }
          ],
          default: NETWORK_TYPES.TCP
        },
        {
          name: 'streamSettings.wsSettings.path',
          label: 'WebSocket 路径',
          type: 'text',
          placeholder: '/vmess',
          condition: 'streamSettings.network === "ws"'
        },
        ...sniffingFields
      ]

    case PROTOCOLS.SHADOWSOCKS:
      return [
        ...baseFields,
        {
          name: 'settings.method',
          label: '加密方式',
          type: 'select',
          required: true,
          options: SS_CIPHERS.map(c => ({ value: c, label: c })),
          default: 'aes-256-gcm',
          help: '推荐使用 aes-256-gcm 或 chacha20-poly1305'
        },
        {
          name: 'settings.password',
          label: '密码',
          type: 'text',
          required: true,
          generator: 'password',
          placeholder: '点击生成按钮自动生成',
          help: '点击生成按钮创建随机密码'
        },
        {
          name: 'settings.network',
          label: '网络协议',
          type: 'select',
          options: [
            { value: 'tcp', label: 'TCP' },
            { value: 'udp', label: 'UDP' },
            { value: 'tcp,udp', label: 'TCP + UDP' }
          ],
          default: 'tcp,udp'
        },
        ...sniffingFields
      ]

    case PROTOCOLS.TROJAN:
      return [
        ...baseFields,
        {
          name: 'settings.clients[0].password',
          label: '密码',
          type: 'text',
          required: true,
          generator: 'password',
          placeholder: '点击生成按钮自动生成',
          help: 'Trojan 协议使用密码而非 UUID'
        },
        {
          name: 'settings.clients[0].email',
          label: '用户标识 (Email)',
          type: 'text',
          placeholder: 'user@example.com'
        },
        {
          name: 'streamSettings.network',
          label: '传输协议',
          type: 'select',
          options: [
            { value: NETWORK_TYPES.TCP, label: 'TCP' },
            { value: NETWORK_TYPES.WS, label: 'WebSocket' }
          ],
          default: NETWORK_TYPES.TCP
        },
        {
          name: 'streamSettings.security',
          label: '传输层安全',
          type: 'select',
          options: [
            { value: TLS_TYPES.TLS, label: 'TLS' }
          ],
          default: TLS_TYPES.TLS
        },
        {
          name: 'streamSettings.tlsSettings.serverName',
          label: 'SNI (ServerName)',
          type: 'text',
          placeholder: 'example.com'
        },
        {
          name: 'streamSettings.tlsSettings.certificates[0].certificateFile',
          label: '证书文件路径',
          type: 'text',
          placeholder: '/path/to/cert.crt'
        },
        {
          name: 'streamSettings.tlsSettings.certificates[0].keyFile',
          label: '密钥文件路径',
          type: 'text',
          placeholder: '/path/to/key.key'
        },
        ...sniffingFields
      ]

    default:
      return baseFields
  }
}

/**
 * 生成 UUID
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 生成随机密码
 */
export const generatePassword = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * 验证 UUID 格式
 */
export const isValidUUID = (uuid) => {
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * 验证端口范围
 */
export const isValidPort = (port) => {
  const num = parseInt(port)
  return !isNaN(num) && num >= 1 && num <= 65535
}

/**
 * 获取嵌套对象的值
 */
export const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    // 处理数组索引，如 clients[0]
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch
      return current?.[arrayKey]?.[parseInt(index)]
    }
    return current?.[key]
  }, obj)
}

/**
 * 设置嵌套对象的值
 */
export const setNestedValue = (obj, path, value) => {
  const keys = path.split('.')
  const lastKey = keys.pop()
  
  let current = obj
  for (const key of keys) {
    // 处理数组索引
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch
      const idx = parseInt(index)
      
      if (!current[arrayKey]) {
        current[arrayKey] = []
      }
      if (!current[arrayKey][idx]) {
        current[arrayKey][idx] = {}
      }
      current = current[arrayKey][idx]
    } else {
      if (!current[key]) {
        current[key] = {}
      }
      current = current[key]
    }
  }
  
  // 处理最后一个键的数组索引
  const arrayMatch = lastKey.match(/^(.+)\[(\d+)\]$/)
  if (arrayMatch) {
    const [, arrayKey, index] = arrayMatch
    const idx = parseInt(index)
    if (!current[arrayKey]) {
      current[arrayKey] = []
    }
    current[arrayKey][idx] = value
  } else {
    current[lastKey] = value
  }
  
  return obj
}

/**
 * 评估条件表达式
 */
export const evaluateCondition = (condition, formData) => {
  if (!condition) return true
  
  try {
    // 简单的条件评估（支持 === 和 !==）
    const match = condition.match(/^(.+?)\s*(===|!==)\s*"(.+?)"$/)
    if (match) {
      const [, path, operator, value] = match
      const actualValue = getNestedValue(formData, path)
      
      if (operator === '===') {
        return actualValue === value
      } else if (operator === '!==') {
        return actualValue !== value
      }
    }
    
    return true
  } catch (e) {
    console.error('Condition evaluation error:', e)
    return true
  }
}
