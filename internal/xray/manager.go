package xray

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
)

// Manager 管理 Xray 实例的动态配置
type Manager struct {
	instance      *Instance
	currentConfig *Config // 维护当前配置状态
	mu            sync.RWMutex
}

// NewManager 创建 Xray 管理器
func NewManager(instance *Instance) *Manager {
	return &Manager{
		instance:      instance,
		currentConfig: nil,
	}
}

// LoadInitialConfig 加载初始配置
func (m *Manager) LoadInitialConfig(jsonConfig []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var config Config
	if err := json.Unmarshal(jsonConfig, &config); err != nil {
		return fmt.Errorf("解析配置失败: %w", err)
	}

	m.currentConfig = &config
	log.Printf("✓ 初始配置已加载: %d 个 Inbound, %d 个 Outbound",
		len(config.Inbounds), len(config.Outbounds))
	return nil
}

// ApplyConfigDiff 应用配置增量（通过热重载）
func (m *Manager) ApplyConfigDiff(action string, content map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.currentConfig == nil {
		return fmt.Errorf("配置未初始化")
	}

	// 提取 tag
	tag, ok := content["tag"].(string)
	if !ok {
		return fmt.Errorf("配置缺少 tag 字段")
	}

	// 判断配置类型
	configType := m.detectConfigType(content)
	log.Printf("[ConfigDiff] 应用配置变更 [类型: %s, 操作: %s, Tag: %s]", configType, action, tag)

	// 应用配置变更
	modified := false
	var err error

	switch action {
	case "ADD":
		modified, err = m.addConfig(configType, tag, content)
	case "UPDATE":
		modified, err = m.updateConfig(configType, tag, content)
	case "DEL", "DELETE":
		modified, err = m.deleteConfig(configType, tag)
	default:
		return fmt.Errorf("未知的操作类型: %s", action)
	}

	if err != nil {
		return err
	}

	// 如果配置有变更，则重新加载
	if modified {
		return m.reloadConfig()
	}

	return nil
}

// detectConfigType 检测配置类型
func (m *Manager) detectConfigType(content map[string]interface{}) string {
	if _, hasPort := content["port"]; hasPort {
		return "inbound"
	}
	if _, hasOutboundTag := content["outboundTag"]; hasOutboundTag {
		return "routing"
	}
	if _, hasSelector := content["selector"]; hasSelector {
		return "balancer"
	}
	if _, hasProtocol := content["protocol"]; hasProtocol {
		return "outbound"
	}
	return "unknown"
}

// addConfig 添加配置
func (m *Manager) addConfig(configType, tag string, content map[string]interface{}) (bool, error) {
	switch configType {
	case "inbound":
		return m.addInbound(tag, content)
	case "outbound":
		return m.addOutbound(tag, content)
	case "routing":
		return m.addRoutingRule(content)
	case "balancer":
		return m.addBalancer(tag, content)
	default:
		return false, fmt.Errorf("不支持的配置类型: %s", configType)
	}
}

// updateConfig 更新配置
func (m *Manager) updateConfig(configType, tag string, content map[string]interface{}) (bool, error) {
	switch configType {
	case "inbound":
		return m.updateInbound(tag, content)
	case "outbound":
		return m.updateOutbound(tag, content)
	case "routing":
		return m.updateRoutingRule(tag, content)
	case "balancer":
		return m.updateBalancer(tag, content)
	default:
		return false, fmt.Errorf("不支持的配置类型: %s", configType)
	}
}

// deleteConfig 删除配置
func (m *Manager) deleteConfig(configType, tag string) (bool, error) {
	switch configType {
	case "inbound":
		return m.deleteInbound(tag)
	case "outbound":
		return m.deleteOutbound(tag)
	case "routing":
		return m.deleteRoutingRule(tag)
	case "balancer":
		return m.deleteBalancer(tag)
	default:
		return false, fmt.Errorf("不支持的配置类型: %s", configType)
	}
}

// === Inbound 管理 ===

func (m *Manager) addInbound(tag string, content map[string]interface{}) (bool, error) {
	// 检查是否已存在
	for _, inbound := range m.currentConfig.Inbounds {
		if inbound.Tag == tag {
			log.Printf("⚠ Inbound %s 已存在，跳过添加", tag)
			return false, nil
		}
	}

	inbound, err := m.mapToInbound(content)
	if err != nil {
		return false, fmt.Errorf("转换 Inbound 配置失败: %w", err)
	}

	m.currentConfig.Inbounds = append(m.currentConfig.Inbounds, *inbound)
	log.Printf("✓ 添加 Inbound: %s (端口: %d)", tag, inbound.Port)
	return true, nil
}

func (m *Manager) updateInbound(tag string, content map[string]interface{}) (bool, error) {
	for i, inbound := range m.currentConfig.Inbounds {
		if inbound.Tag == tag {
			updated, err := m.mapToInbound(content)
			if err != nil {
				return false, fmt.Errorf("转换 Inbound 配置失败: %w", err)
			}
			m.currentConfig.Inbounds[i] = *updated
			log.Printf("✓ 更新 Inbound: %s (端口: %d)", tag, updated.Port)
			return true, nil
		}
	}
	return false, fmt.Errorf("Inbound %s 不存在", tag)
}

func (m *Manager) deleteInbound(tag string) (bool, error) {
	for i, inbound := range m.currentConfig.Inbounds {
		if inbound.Tag == tag {
			m.currentConfig.Inbounds = append(
				m.currentConfig.Inbounds[:i],
				m.currentConfig.Inbounds[i+1:]...,
			)
			log.Printf("✓ 删除 Inbound: %s", tag)
			return true, nil
		}
	}
	return false, fmt.Errorf("Inbound %s 不存在", tag)
}

// === Outbound 管理 ===

func (m *Manager) addOutbound(tag string, content map[string]interface{}) (bool, error) {
	// 检查是否已存在
	for _, outbound := range m.currentConfig.Outbounds {
		if outbound.Tag == tag {
			log.Printf("⚠ Outbound %s 已存在，跳过添加", tag)
			return false, nil
		}
	}

	outbound, err := m.mapToOutbound(content)
	if err != nil {
		return false, fmt.Errorf("转换 Outbound 配置失败: %w", err)
	}

	m.currentConfig.Outbounds = append(m.currentConfig.Outbounds, *outbound)
	log.Printf("✓ 添加 Outbound: %s (协议: %s)", tag, outbound.Protocol)
	return true, nil
}

func (m *Manager) updateOutbound(tag string, content map[string]interface{}) (bool, error) {
	for i, outbound := range m.currentConfig.Outbounds {
		if outbound.Tag == tag {
			updated, err := m.mapToOutbound(content)
			if err != nil {
				return false, fmt.Errorf("转换 Outbound 配置失败: %w", err)
			}
			m.currentConfig.Outbounds[i] = *updated
			log.Printf("✓ 更新 Outbound: %s (协议: %s)", tag, updated.Protocol)
			return true, nil
		}
	}
	return false, fmt.Errorf("Outbound %s 不存在", tag)
}

func (m *Manager) deleteOutbound(tag string) (bool, error) {
	for i, outbound := range m.currentConfig.Outbounds {
		if outbound.Tag == tag {
			m.currentConfig.Outbounds = append(
				m.currentConfig.Outbounds[:i],
				m.currentConfig.Outbounds[i+1:]...,
			)
			log.Printf("✓ 删除 Outbound: %s", tag)
			return true, nil
		}
	}
	return false, fmt.Errorf("Outbound %s 不存在", tag)
}

// === Routing 管理 ===

func (m *Manager) addRoutingRule(content map[string]interface{}) (bool, error) {
	// 确保 Routing 存在
	if m.currentConfig.Routing == nil {
		m.currentConfig.Routing = &RoutingConfig{}
	}

	rule, err := m.mapToRoutingRule(content)
	if err != nil {
		return false, fmt.Errorf("转换 Routing 规则失败: %w", err)
	}

	m.currentConfig.Routing.Rules = append(m.currentConfig.Routing.Rules, *rule)
	log.Printf("✓ 添加路由规则: 出站=%s", rule.OutboundTag)
	return true, nil
}

func (m *Manager) updateRoutingRule(tag string, content map[string]interface{}) (bool, error) {
	if m.currentConfig.Routing == nil {
		return false, fmt.Errorf("路由配置不存在")
	}

	// 使用 outboundTag 作为唯一标识
	outboundTag, _ := content["outboundTag"].(string)
	for i, rule := range m.currentConfig.Routing.Rules {
		if rule.OutboundTag == outboundTag {
			updated, err := m.mapToRoutingRule(content)
			if err != nil {
				return false, fmt.Errorf("转换 Routing 规则失败: %w", err)
			}
			m.currentConfig.Routing.Rules[i] = *updated
			log.Printf("✓ 更新路由规则: 出站=%s", updated.OutboundTag)
			return true, nil
		}
	}
	return false, fmt.Errorf("路由规则不存在: %s", outboundTag)
}

func (m *Manager) deleteRoutingRule(tag string) (bool, error) {
	if m.currentConfig.Routing == nil {
		return false, fmt.Errorf("路由配置不存在")
	}

	// tag 实际上是 outboundTag
	for i, rule := range m.currentConfig.Routing.Rules {
		if rule.OutboundTag == tag {
			m.currentConfig.Routing.Rules = append(
				m.currentConfig.Routing.Rules[:i],
				m.currentConfig.Routing.Rules[i+1:]...,
			)
			log.Printf("✓ 删除路由规则: 出站=%s", tag)
			return true, nil
		}
	}
	return false, fmt.Errorf("路由规则不存在: %s", tag)
}

// === Balancer 管理 ===

func (m *Manager) addBalancer(tag string, content map[string]interface{}) (bool, error) {
	// 确保 Routing 存在
	if m.currentConfig.Routing == nil {
		m.currentConfig.Routing = &RoutingConfig{}
	}

	// 检查是否已存在
	for _, balancer := range m.currentConfig.Routing.Balancers {
		if balancer.Tag == tag {
			log.Printf("⚠ Balancer %s 已存在，跳过添加", tag)
			return false, nil
		}
	}

	balancer, err := m.mapToBalancer(content)
	if err != nil {
		return false, fmt.Errorf("转换 Balancer 配置失败: %w", err)
	}

	m.currentConfig.Routing.Balancers = append(m.currentConfig.Routing.Balancers, *balancer)
	log.Printf("✓ 添加负载均衡器: %s (策略: %s)", tag, balancer.Strategy)
	return true, nil
}

func (m *Manager) updateBalancer(tag string, content map[string]interface{}) (bool, error) {
	if m.currentConfig.Routing == nil {
		return false, fmt.Errorf("路由配置不存在")
	}

	for i, balancer := range m.currentConfig.Routing.Balancers {
		if balancer.Tag == tag {
			updated, err := m.mapToBalancer(content)
			if err != nil {
				return false, fmt.Errorf("转换 Balancer 配置失败: %w", err)
			}
			m.currentConfig.Routing.Balancers[i] = *updated
			log.Printf("✓ 更新负载均衡器: %s (策略: %s)", tag, updated.Strategy)
			return true, nil
		}
	}
	return false, fmt.Errorf("Balancer %s 不存在", tag)
}

func (m *Manager) deleteBalancer(tag string) (bool, error) {
	if m.currentConfig.Routing == nil {
		return false, fmt.Errorf("路由配置不存在")
	}

	for i, balancer := range m.currentConfig.Routing.Balancers {
		if balancer.Tag == tag {
			m.currentConfig.Routing.Balancers = append(
				m.currentConfig.Routing.Balancers[:i],
				m.currentConfig.Routing.Balancers[i+1:]...,
			)
			log.Printf("✓ 删除负载均衡器: %s", tag)
			return true, nil
		}
	}
	return false, fmt.Errorf("Balancer %s 不存在", tag)
}

// mapToInbound 将 map 转换为 Inbound
func (m *Manager) mapToInbound(data map[string]interface{}) (*Inbound, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	var inbound Inbound
	if err := json.Unmarshal(jsonData, &inbound); err != nil {
		return nil, err
	}

	return &inbound, nil
}

// mapToOutbound 将 map 转换为 Outbound
func (m *Manager) mapToOutbound(data map[string]interface{}) (*Outbound, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	var outbound Outbound
	if err := json.Unmarshal(jsonData, &outbound); err != nil {
		return nil, err
	}

	return &outbound, nil
}

// mapToRoutingRule 将 map 转换为 RoutingRule
func (m *Manager) mapToRoutingRule(data map[string]interface{}) (*RoutingRule, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	var rule RoutingRule
	if err := json.Unmarshal(jsonData, &rule); err != nil {
		return nil, err
	}

	return &rule, nil
}

// mapToBalancer 将 map 转换为 Balancer
func (m *Manager) mapToBalancer(data map[string]interface{}) (*Balancer, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	var balancer Balancer
	if err := json.Unmarshal(jsonData, &balancer); err != nil {
		return nil, err
	}

	return &balancer, nil
}

// reloadConfig 重新加载配置到 Xray 实例
func (m *Manager) reloadConfig() error {
	// 序列化当前配置
	configJSON, err := json.MarshalIndent(m.currentConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	log.Printf("[ConfigReload] 开始重新加载配置...")
	log.Printf("[ConfigReload] 当前配置: %d 个 Inbound, %d 个 Outbound",
		len(m.currentConfig.Inbounds), len(m.currentConfig.Outbounds))

	// 停止当前实例
	if m.instance.IsRunning() {
		log.Printf("[ConfigReload] 停止当前 Xray 实例...")
		if err := m.instance.Stop(); err != nil {
			return fmt.Errorf("停止实例失败: %w", err)
		}
	}

	// 加载新配置
	log.Printf("[ConfigReload] 加载新配置到实例...")
	if err := m.instance.LoadConfigFromJSON(configJSON); err != nil {
		return fmt.Errorf("加载配置失败: %w", err)
	}

	// 启动实例
	log.Printf("[ConfigReload] 启动 Xray 实例...")
	if err := m.instance.Start(); err != nil {
		return fmt.Errorf("启动实例失败: %w", err)
	}

	log.Printf("✓ 配置热重载完成")
	return nil
}

// ReloadFullConfig 重新加载完整配置
func (m *Manager) ReloadFullConfig(jsonConfig []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	log.Println("重新加载完整配置...")

	// 停止当前实例
	if m.instance.IsRunning() {
		if err := m.instance.Stop(); err != nil {
			return fmt.Errorf("停止实例失败: %w", err)
		}
	}

	// 加载新配置
	if err := m.instance.LoadConfigFromJSON(jsonConfig); err != nil {
		return fmt.Errorf("加载配置失败: %w", err)
	}

	// 启动实例
	if err := m.instance.Start(); err != nil {
		return fmt.Errorf("启动实例失败: %w", err)
	}

	log.Println("✓ 配置已重新加载")
	return nil
}

// GetStatus 获取管理器状态
func (m *Manager) GetStatus() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return map[string]interface{}{
		"running": m.instance.IsRunning(),
	}
}
