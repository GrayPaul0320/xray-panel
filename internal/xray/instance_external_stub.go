// +build noembedded

package xray

// initEmbedded 初始化嵌入模式（存根实现）
func (i *Instance) initEmbedded() {
	// 无操作 - 编译时禁用嵌入模式
}

// loadConfigEmbedded 嵌入模式加载配置（存根实现）
func (i *Instance) loadConfigEmbedded(jsonConfig []byte) error {
	return fmt.Errorf("嵌入模式已禁用，请使用 XRAY_MODE=external 或安装 xray 可执行文件")
}

// startEmbedded 嵌入模式启动（存根实现）
func (i *Instance) startEmbedded() error {
	return fmt.Errorf("嵌入模式已禁用")
}

// stopEmbedded 嵌入模式停止（存根实现）
func (i *Instance) stopEmbedded() error {
	return nil
}

// GetServer 获取 core.Instance（存根实现）
func (i *Instance) GetServer() interface{} {
	return nil
}
