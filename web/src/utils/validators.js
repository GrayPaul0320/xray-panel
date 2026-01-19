/**
 * 表单字段验证工具
 * 提供各种常用的验证函数
 */

/**
 * 验证端口号（1-65535）
 */
export const validatePort = (port) => {
  const num = parseInt(port)
  if (isNaN(num)) {
    return { valid: false, message: '端口必须是数字' }
  }
  if (num < 1 || num > 65535) {
    return { valid: false, message: '端口范围必须在 1-65535 之间' }
  }
  return { valid: true }
}

/**
 * 验证 UUID 格式
 * 支持标准 UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const validateUUID = (uuid) => {
  if (!uuid) {
    return { valid: false, message: 'UUID 不能为空' }
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(uuid)) {
    return { valid: false, message: 'UUID 格式无效（格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）' }
  }
  return { valid: true }
}

/**
 * 验证 IPv4 地址
 */
export const validateIPv4 = (ip) => {
  if (!ip) {
    return { valid: false, message: 'IP 地址不能为空' }
  }
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (!ipv4Regex.test(ip)) {
    return { valid: false, message: 'IPv4 地址格式无效' }
  }
  return { valid: true }
}

/**
 * 验证 IPv6 地址
 */
export const validateIPv6 = (ip) => {
  if (!ip) {
    return { valid: false, message: 'IP 地址不能为空' }
  }
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
  if (!ipv6Regex.test(ip)) {
    return { valid: false, message: 'IPv6 地址格式无效' }
  }
  return { valid: true }
}

/**
 * 验证 IP 地址（IPv4 或 IPv6）
 */
export const validateIP = (ip) => {
  if (!ip) {
    return { valid: false, message: 'IP 地址不能为空' }
  }
  const ipv4Result = validateIPv4(ip)
  if (ipv4Result.valid) {
    return ipv4Result
  }
  return validateIPv6(ip)
}

/**
 * 验证域名
 */
export const validateDomain = (domain) => {
  if (!domain) {
    return { valid: false, message: '域名不能为空' }
  }
  // 支持通配符域名（*.example.com）
  const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
  if (!domainRegex.test(domain)) {
    return { valid: false, message: '域名格式无效' }
  }
  return { valid: true }
}

/**
 * 验证路径（以 / 开头）
 */
export const validatePath = (path) => {
  if (!path) {
    return { valid: false, message: '路径不能为空' }
  }
  if (!path.startsWith('/')) {
    return { valid: false, message: '路径必须以 / 开头' }
  }
  return { valid: true }
}

/**
 * 验证加密方式（AES、ChaCha20 等）
 */
export const validateEncryption = (encryption, allowedValues) => {
  if (!encryption) {
    return { valid: false, message: '加密方式不能为空' }
  }
  if (allowedValues && !allowedValues.includes(encryption)) {
    return { valid: false, message: `加密方式必须是以下之一: ${allowedValues.join(', ')}` }
  }
  return { valid: true }
}

/**
 * 验证 Base64 编码字符串
 */
export const validateBase64 = (str) => {
  if (!str) {
    return { valid: false, message: 'Base64 字符串不能为空' }
  }
  const base64Regex = /^[A-Za-z0-9+/]+=*$/
  if (!base64Regex.test(str)) {
    return { valid: false, message: 'Base64 格式无效' }
  }
  return { valid: true }
}

/**
 * 验证密码强度（至少 8 个字符）
 */
export const validatePassword = (password, minLength = 8) => {
  if (!password) {
    return { valid: false, message: '密码不能为空' }
  }
  if (password.length < minLength) {
    return { valid: false, message: `密码长度至少为 ${minLength} 个字符` }
  }
  return { valid: true }
}

/**
 * 验证正整数
 */
export const validatePositiveInteger = (value) => {
  const num = parseInt(value)
  if (isNaN(num)) {
    return { valid: false, message: '必须是数字' }
  }
  if (num <= 0) {
    return { valid: false, message: '必须是正整数' }
  }
  return { valid: true }
}

/**
 * 验证数字范围
 */
export const validateRange = (value, min, max) => {
  const num = parseFloat(value)
  if (isNaN(num)) {
    return { valid: false, message: '必须是数字' }
  }
  if (num < min || num > max) {
    return { valid: false, message: `值必须在 ${min} 到 ${max} 之间` }
  }
  return { valid: true }
}

/**
 * 根据字段定义自动选择验证器
 */
export const validateField = (field, value) => {
  // 如果字段不是必填且值为空，直接通过
  if (!field.required && (!value || value === '')) {
    return { valid: true }
  }

  // 必填字段检查
  if (field.required && (!value || value === '')) {
    return { valid: false, message: `${field.label} 不能为空` }
  }

  // 根据字段名称或验证类型选择验证器
  if (field.validator) {
    switch (field.validator) {
      case 'port':
        return validatePort(value)
      case 'uuid':
        return validateUUID(value)
      case 'ipv4':
        return validateIPv4(value)
      case 'ipv6':
        return validateIPv6(value)
      case 'ip':
        return validateIP(value)
      case 'domain':
        return validateDomain(value)
      case 'path':
        return validatePath(value)
      case 'base64':
        return validateBase64(value)
      case 'password':
        return validatePassword(value, field.minLength)
      case 'positiveInteger':
        return validatePositiveInteger(value)
      default:
        break
    }
  }

  // 端口字段自动验证
  if (field.name === 'port' || field.label?.includes('端口')) {
    return validatePort(value)
  }

  // UUID 字段自动验证
  if (field.name === 'id' || field.name === 'uuid' || field.label?.includes('UUID')) {
    return validateUUID(value)
  }

  // 数字范围验证
  if (field.type === 'number' && (field.min !== undefined || field.max !== undefined)) {
    return validateRange(value, field.min || -Infinity, field.max || Infinity)
  }

  // 自定义正则验证
  if (field.pattern) {
    const regex = new RegExp(field.pattern)
    if (!regex.test(value)) {
      return { valid: false, message: field.patternMessage || '格式不正确' }
    }
  }

  return { valid: true }
}
