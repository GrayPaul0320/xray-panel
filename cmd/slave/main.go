package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/graypaul/xray-panel/internal/comm"
	"github.com/graypaul/xray-panel/internal/xray"
)

func main() {
	// 命令行参数
	configFile := flag.String("config", "config.json", "Xray 配置文件路径")
	masterURL := flag.String("master", "ws://localhost:9090/ws", "Master 节点 WebSocket 地址")
	token := flag.String("token", "", "JWT Token")
	versionFile := flag.String("version", "./data/version.json", "版本文件路径")
	xrayPath := flag.String("xray-path", "./bin/xray", "Xray 可执行文件路径")
	flag.Parse()

	if *token == "" {
		log.Fatal("✗ 必须提供 JWT Token (-token)")
	}

	log.Println("========================================")
	log.Println("Xray Panel - Slave 节点")
	log.Println("========================================")

	// 初始化版本存储
	versionStore, err := xray.NewVersionStore(*versionFile)
	if err != nil {
		log.Fatalf("✗ 初始化版本存储失败: %v", err)
	}
	currentVersion := versionStore.GetVersion()
	log.Printf("✓ 版本存储初始化完成，当前版本: %d", currentVersion)

	// 创建 Xray 实例
	instance := xray.NewInstanceWithPath(*xrayPath)
	log.Printf("✓ Xray 实例已创建 (路径: %s)", *xrayPath)

	// 加载配置
	var configData []byte

	if _, err := os.Stat(*configFile); err == nil {
		// 从文件加载配置
		configData, err = xray.LoadConfigFromFile(*configFile)
		if err != nil {
			log.Fatalf("✗ 加载配置文件失败: %v", err)
		}
		log.Printf("✓ 从文件加载配置: %s", *configFile)
	} else {
		// 使用默认配置
		configData = xray.GetDefaultConfig()
		log.Println("✓ 使用默认配置")
	}

	// 验证配置
	if err := xray.ValidateConfig(configData); err != nil {
		log.Fatalf("✗ 配置验证失败: %v", err)
	}
	log.Println("✓ 配置验证通过")

	// 加载配置到实例
	if err := instance.LoadConfigFromJSON(configData); err != nil {
		log.Fatalf("✗ 加载配置到 Xray 实例失败: %v", err)
	}
	log.Println("✓ 配置已加载到 Xray 实例")

	// 启动 Xray
	if err := instance.Start(); err != nil {
		log.Fatalf("✗ 启动 Xray 失败: %v", err)
	}
	log.Println("✓ Xray 已成功启动")

	// 创建 Xray 管理器
	manager := xray.NewManager(instance)
	log.Println("✓ Xray 管理器已创建")

	// 加载初始配置到管理器
	if err := manager.LoadInitialConfig(configData); err != nil {
		log.Fatalf("✗ 加载初始配置到管理器失败: %v", err)
	}

	// 创建 WebSocket 客户端
	client := comm.NewSlaveClient(*masterURL, *token)
	log.Println("✓ WebSocket 客户端已创建")

	// 创建流量收集器
	trafficCollector := xray.NewTrafficCollector(instance)
	log.Println("✓ 流量收集器已创建")

	// 注册消息处理器
	setupMessageHandlers(client, manager, versionStore, trafficCollector, instance)

	// 连接到 Master
	if err := client.Connect(); err != nil {
		log.Fatalf("✗ 连接到 Master 失败: %v", err)
	}

	// 上报 IP 地址
	localIP := getLocalIP()
	if localIP != "" {
		log.Printf("✓ 检测到本地 IP: %s", localIP)
		if err := client.SendMessage(comm.MessageTypeReportIP, map[string]interface{}{
			"ip": localIP,
		}); err != nil {
			log.Printf("上报 IP 地址失败: %v", err)
		} else {
			log.Printf("✓ 已上报 IP 地址到 Master")
		}
	} else {
		log.Println("⚠ 无法检测到本地 IP 地址")
	}

	// 发送 Xray 状态
	xrayStatus := "stopped"
	if instance.IsRunning() {
		xrayStatus = "running"
	}
	if err := client.SendMessage("xray_status", map[string]interface{}{
		"status": xrayStatus,
	}); err != nil {
		log.Printf("发送 Xray 状态失败: %v", err)
	}

	// 启动流量收集器
	trafficCollector.Start(func(stats map[string]*xray.TrafficSnapshot) {
		// 流量上报回调
		trafficData := make(map[string]interface{})
		for tag, snapshot := range stats {
			trafficData[tag] = map[string]interface{}{
				"uplink":   snapshot.Uplink,
				"downlink": snapshot.Downlink,
			}
		}
		
		if len(trafficData) > 0 {
			if err := client.SendMessage(comm.MessageTypeTrafficReport, map[string]interface{}{
				"traffic": trafficData,
			}); err != nil {
				log.Printf("发送流量上报失败: %v", err)
			} else {
				log.Printf("✓ 已上报 %d 个 inbound 的流量数据", len(trafficData))
			}
		}
	})

	// 请求配置同步
	if err := client.RequestSync(currentVersion); err != nil {
		log.Printf("✗ 请求同步失败: %v", err)
	}

	log.Println("========================================")
	log.Println("✓ Slave 节点启动成功")
	log.Println("========================================")

	// 等待中断信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	fmt.Println("Slave 节点正在运行... (按 Ctrl+C 停止)")
	<-sigChan

	// 优雅关闭
	log.Println("\n正在关闭 Slave 节点...")

	// 停止流量收集器
	trafficCollector.Stop()

	if err := client.Disconnect(); err != nil {
		log.Printf("✗ 断开 WebSocket 连接失败: %v", err)
	} else {
		log.Println("✓ WebSocket 已断开")
	}

	if err := instance.Stop(); err != nil {
		log.Printf("✗ 停止 Xray 失败: %v", err)
	} else {
		log.Println("✓ Xray 已停止")
	}

	log.Println("Slave 节点已关闭")
}

// setupMessageHandlers 设置消息处理器
func setupMessageHandlers(client *comm.SlaveClient, manager *xray.Manager, versionStore *xray.VersionStore, trafficCollector *xray.TrafficCollector, instance *xray.Instance) {
	// 处理认证消息
	client.RegisterHandler(comm.MessageTypeAuth, func(msg *comm.Message) error {
		status, _ := msg.Data["status"].(string)
		message, _ := msg.Data["message"].(string)
		log.Printf("认证响应: %s - %s", status, message)
		
		// 认证成功后发送 Xray 状态
		if status == "success" {
			xrayStatus := "stopped"
			if instance.IsRunning() {
				xrayStatus = "running"
			}
			if err := client.SendMessage("xray_status", map[string]interface{}{
				"status": xrayStatus,
			}); err != nil {
				log.Printf("发送 Xray 状态失败: %v", err)
			}
		}
		return nil
	})

	// 处理配置增量消息
	client.RegisterHandler(comm.MessageTypeConfigDiff, func(msg *comm.Message) error {
		version, ok := msg.Data["version"].(float64)
		if !ok {
			return fmt.Errorf("无效的版本号")
		}

		action, ok := msg.Data["action"].(string)
		if !ok {
			return fmt.Errorf("无效的操作类型")
		}

		content, ok := msg.Data["content"].(map[string]interface{})
		if !ok {
			return fmt.Errorf("无效的配置内容")
		}

		log.Printf("收到配置增量 [版本: %.0f, 操作: %s]", version, action)

		// 应用配置增量
		if err := manager.ApplyConfigDiff(action, content); err != nil {
			log.Printf("✗ 应用配置失败: %v", err)
			client.SendAck(int64(version), "error", fmt.Sprintf("应用配置失败: %v", err))
			return err
		}

		// 更新版本
		if err := versionStore.UpdateVersion(int64(version)); err != nil {
			log.Printf("✗ 更新版本失败: %v", err)
			return err
		}

		log.Printf("✓ 配置已应用,版本更新至: %.0f", version)

		// 发送 Xray 状态更新
		xrayStatus := "stopped"
		if instance.IsRunning() {
			xrayStatus = "running"
		}
		if err := client.SendMessage("xray_status", map[string]interface{}{
			"status": xrayStatus,
		}); err != nil {
			log.Printf("发送 Xray 状态失败: %v", err)
		}

		// 发送确认
		client.SendAck(int64(version), "success", "配置已成功应用")
		return nil
	})

	// 处理确认消息
	client.RegisterHandler(comm.MessageTypeAck, func(msg *comm.Message) error {
		status, _ := msg.Data["status"].(string)
		message, _ := msg.Data["message"].(string)
		versionFloat, _ := msg.Data["version"].(float64)
		
		if status == "up_to_date" {
			log.Printf("配置已是最新 (版本: %.0f)", versionFloat)
		} else if status == "sync_complete" {
			diffsApplied, _ := msg.Data["diffs_applied"].(float64)
			log.Printf("同步完成: %s, 应用了 %.0f 个配置增量", message, diffsApplied)
		} else {
			log.Printf("ACK: %s - %s", status, message)
		}
		return nil
	})

	// 处理错误消息
	client.RegisterHandler(comm.MessageTypeError, func(msg *comm.Message) error {
		errMsg, _ := msg.Data["error"].(string)
		log.Printf("✗ 服务器错误: %s", errMsg)
		return nil
	})

	// 处理 Pong 消息
	client.RegisterHandler(comm.MessageTypePong, func(msg *comm.Message) error {
		// 心跳响应，不需要特殊处理
		return nil
	})
}

// getLocalIP 获取本地 IP 地址
func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		log.Printf("获取网络接口地址失败: %v", err)
		return ""
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}

	return ""
}
