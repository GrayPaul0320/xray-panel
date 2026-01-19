package xray

import (
	"encoding/json"
	"os"
)

// Config 表示完整的 Xray 配置结构
type Config struct {
	Log       *LogConfig       `json:"log,omitempty"`
	API       *API             `json:"api,omitempty"`
	Stats     *Stats           `json:"stats,omitempty"`
	Policy    *Policy          `json:"policy,omitempty"`
	Inbounds  []Inbound        `json:"inbounds"`
	Outbounds []Outbound       `json:"outbounds"`
	Routing   *RoutingConfig   `json:"routing,omitempty"`
}

// API API 配置
type API struct {
	Tag      string   `json:"tag"`
	Services []string `json:"services"`
}

// Stats 统计配置
type Stats struct{}

// Policy 策略配置
type Policy struct {
	Levels map[string]interface{} `json:"levels,omitempty"`
	System *SystemPolicy          `json:"system,omitempty"`
}

// SystemPolicy 系统策略
type SystemPolicy struct {
	StatsInboundUplink   bool `json:"statsInboundUplink,omitempty"`
	StatsInboundDownlink bool `json:"statsInboundDownlink,omitempty"`
}

// LogConfig 日志配置
type LogConfig struct {
	Loglevel string `json:"loglevel"`
}

// StatsConfig 统计配置（兼容性别名）
type StatsConfig struct{}

// PolicyConfig 策略配置（兼容性别名）
type PolicyConfig struct {
	Levels map[string]interface{} `json:"levels,omitempty"`
	System map[string]interface{} `json:"system,omitempty"`
}

// Inbound 入站配置
type Inbound struct {
	Tag            string                 `json:"tag"`
	Port           int                    `json:"port"`
	Protocol       string                 `json:"protocol"`
	Listen         string                 `json:"listen,omitempty"`
	Settings       map[string]interface{} `json:"settings,omitempty"`
	StreamSettings map[string]interface{} `json:"streamSettings,omitempty"`
}

// InboundConfig 入站配置（兼容性别名）
type InboundConfig struct {
	Tag            string                 `json:"tag"`
	Port           int                    `json:"port"`
	Protocol       string                 `json:"protocol"`
	Listen         string                 `json:"listen,omitempty"`
	Settings       map[string]interface{} `json:"settings,omitempty"`
	StreamSettings map[string]interface{} `json:"streamSettings,omitempty"`
}

// Outbound 出站配置
type Outbound struct {
	Tag            string                 `json:"tag"`
	Protocol       string                 `json:"protocol"`
	Settings       map[string]interface{} `json:"settings,omitempty"`
	StreamSettings map[string]interface{} `json:"streamSettings,omitempty"`
	ProxySettings  map[string]interface{} `json:"proxySettings,omitempty"`
	Mux            map[string]interface{} `json:"mux,omitempty"`
}

// RoutingConfig 路由配置
type RoutingConfig struct {
	DomainStrategy string        `json:"domainStrategy,omitempty"` // AsIs, IPIfNonMatch, IPOnDemand
	DomainMatcher  string        `json:"domainMatcher,omitempty"`  // linear, mph
	Rules          []RoutingRule `json:"rules,omitempty"`
	Balancers      []Balancer    `json:"balancers,omitempty"`
}

// RoutingRule 路由规则
type RoutingRule struct {
	Type        string   `json:"type,omitempty"`        // field
	Domain      []string `json:"domain,omitempty"`      // 域名匹配
	IP          []string `json:"ip,omitempty"`          // IP 匹配
	Port        string   `json:"port,omitempty"`        // 端口匹配
	Network     string   `json:"network,omitempty"`     // tcp, udp
	Source      []string `json:"source,omitempty"`      // 源地址
	User        []string `json:"user,omitempty"`        // 用户
	InboundTag  []string `json:"inboundTag,omitempty"`  // 入站标签
	Protocol    []string `json:"protocol,omitempty"`    // 协议
	Attrs       string   `json:"attrs,omitempty"`       // 属性匹配
	OutboundTag string   `json:"outboundTag,omitempty"` // 出站标签
	BalancerTag string   `json:"balancerTag,omitempty"` // 负载均衡标签
}

// Balancer 负载均衡器
type Balancer struct {
	Tag      string   `json:"tag"`
	Selector []string `json:"selector"` // 选择器（使用前缀匹配）
	Strategy string   `json:"strategy,omitempty"` // random, leastPing, leastLoad
}

// LoadConfigFromFile 从文件加载配置
func LoadConfigFromFile(filepath string) ([]byte, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return nil, err
	}
	return data, nil
}

// ValidateConfig 验证配置的基本结构
func ValidateConfig(jsonConfig []byte) error {
	var config Config
	return json.Unmarshal(jsonConfig, &config)
}

// GetDefaultConfig 返回一个默认的基础配置
func GetDefaultConfig() []byte {
	config := Config{
		Log: &LogConfig{
			Loglevel: "info",
		},
		Inbounds: []Inbound{
			{
				Tag:      "socks-in",
				Port:     10808,
				Protocol: "socks",
				Settings: map[string]interface{}{
					"auth": "noauth",
					"udp":  true,
				},
			},
		},
		Outbounds: []Outbound{
			{
				Tag:      "direct",
				Protocol: "freedom",
				Settings: map[string]interface{}{},
			},
		},
	}

	data, _ := json.MarshalIndent(config, "", "  ")
	return data
}
