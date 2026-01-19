package xray

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Instance 封装 Xray 实例（外部进程模式）
type Instance struct {
	cmd        *exec.Cmd
	xrayPath   string
	configPath string
	config     []byte
	mu         sync.RWMutex
	isRunning  bool
	apiPort    int // Xray API 端口
}

// NewInstance 创建一个新的 Xray 实例（使用默认路径）
func NewInstance() *Instance {
	return &Instance{
		xrayPath: "xray",
		apiPort:  10085, // 默认 API 端口
	}
}

// NewInstanceWithPath 创建指定路径的 Xray 实例
func NewInstanceWithPath(xrayPath string) *Instance {
	if xrayPath == "" {
		xrayPath = "xray"
	}
	return &Instance{
		xrayPath: xrayPath,
		apiPort:  10085,
	}
}

// LoadConfigFromJSON 从 JSON 配置加载
func (i *Instance) LoadConfigFromJSON(jsonConfig []byte) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	// 1. 验证 JSON 格式
	var config Config
	if err := json.Unmarshal(jsonConfig, &config); err != nil {
		return fmt.Errorf("解析配置失败: %w", err)
	}

	// 2. 确保配置中包含 Stats (用于流量统计)
	if config.Stats == nil {
		config.Stats = &Stats{}
	}

	// 3. 确保配置中包含 API 配置（用于外部调用）
	if config.API == nil {
		config.API = &API{
			Tag:      "api",
			Services: []string{"StatsService", "HandlerService"},
		}
	}

	// 4. 确保配置中包含 Policy (用于开启流量统计)
	if config.Policy == nil {
		config.Policy = &Policy{
			System: &SystemPolicy{
				StatsInboundUplink:   true,
				StatsInboundDownlink: true,
			},
		}
	} else if config.Policy.System == nil {
		config.Policy.System = &SystemPolicy{
			StatsInboundUplink:   true,
			StatsInboundDownlink: true,
		}
	} else {
		// 确保开启统计
		config.Policy.System.StatsInboundUplink = true
		config.Policy.System.StatsInboundDownlink = true
	}

	// 5. 确保 API inbound 存在
	apiExists := false
	for _, inbound := range config.Inbounds {
		if inbound.Tag == "api" {
			apiExists = true
			break
		}
	}
	if !apiExists {
		config.Inbounds = append(config.Inbounds, Inbound{
			Tag:      "api",
			Listen:   "127.0.0.1",
			Port:     i.apiPort,
			Protocol: "dokodemo-door",
			Settings: map[string]interface{}{
				"address": "127.0.0.1",
			},
		})
	}

	// 6. 确保 routing 规则包含 API 路由
	if config.Routing == nil {
		config.Routing = &RoutingConfig{}
	}
	apiRuleExists := false
	for _, rule := range config.Routing.Rules {
		if rule.OutboundTag == "api" {
			apiRuleExists = true
			break
		}
	}
	if !apiRuleExists {
		config.Routing.Rules = append([]RoutingRule{{
			Type:        "field",
			InboundTag:  []string{"api"},
			OutboundTag: "api",
		}}, config.Routing.Rules...)
	}

	// 重新序列化配置
	updatedConfig, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	// 保存配置
	i.config = updatedConfig

	return nil
}

// Start 启动 Xray 实例
func (i *Instance) Start() error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if len(i.config) == 0 {
		return fmt.Errorf("实例未初始化，请先加载配置")
	}

	// 如果已经在运行，先停止
	if i.isRunning {
		i.mu.Unlock()
		i.Stop()
		i.mu.Lock()
	}

	// 创建临时配置文件
	tmpDir := os.TempDir()
	configPath := filepath.Join(tmpDir, fmt.Sprintf("xray-config-%d.json", time.Now().UnixNano()))

	if err := ioutil.WriteFile(configPath, i.config, 0600); err != nil {
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	i.configPath = configPath

	// 启动 Xray 进程
	i.cmd = exec.Command(i.xrayPath, "run", "-c", configPath)
	i.cmd.Stdout = os.Stdout
	i.cmd.Stderr = os.Stderr

	if err := i.cmd.Start(); err != nil {
		os.Remove(configPath)
		return fmt.Errorf("启动 Xray 进程失败: %w", err)
	}

	i.isRunning = true
	log.Printf("Xray Core (外部模式) 已启动，PID: %d", i.cmd.Process.Pid)

	// 等待一下让服务完全启动
	time.Sleep(500 * time.Millisecond)

	return nil
}

// Stop 停止 Xray 实例
func (i *Instance) Stop() error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if !i.isRunning || i.cmd == nil || i.cmd.Process == nil {
		return nil
	}

	// 发送终止信号
	if err := i.cmd.Process.Kill(); err != nil {
		log.Printf("终止 Xray 进程失败: %v", err)
	}

	// 等待进程结束
	i.cmd.Wait()

	// 清理配置文件
	if i.configPath != "" {
		os.Remove(i.configPath)
		i.configPath = ""
	}

	i.isRunning = false
	i.cmd = nil

	log.Println("Xray Core 已停止")
	return nil
}

// IsRunning 检查实例是否正在运行
func (i *Instance) IsRunning() bool {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.isRunning && i.cmd != nil && i.cmd.Process != nil
}

// Reload 重新加载配置并重启实例
func (i *Instance) Reload(jsonConfig []byte) error {
	if err := i.LoadConfigFromJSON(jsonConfig); err != nil {
		return err
	}
	return i.Start()
}

// Cleanup 清理资源
func (i *Instance) Cleanup() error {
	return i.Stop()
}

// GetAPIPort 获取 API 端口
func (i *Instance) GetAPIPort() int {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.apiPort
}

// SetAPIPort 设置 API 端口
func (i *Instance) SetAPIPort(port int) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.apiPort = port
}

// GetConfigPath 获取配置文件路径
func (i *Instance) GetConfigPath() string {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.configPath
}

// GetXrayPath 获取 Xray 可执行文件路径
func (i *Instance) GetXrayPath() string {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.xrayPath
}
