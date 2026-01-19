package comm

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/graypaul/xray-panel/internal/model"
)

// SyncManager 同步管理器
type SyncManager struct {
	db      *model.DB
	hub     *Hub
	jwtAuth *JWTAuth
}

// NewSyncManager 创建同步管理器
func NewSyncManager(db *model.DB, hub *Hub, jwtAuth *JWTAuth) *SyncManager {
	return &SyncManager{
		db:      db,
		hub:     hub,
		jwtAuth: jwtAuth,
	}
}

// HandleMessage 处理来自客户端的消息
func (sm *SyncManager) HandleMessage(client *Client, msg *Message) {
	log.Printf("收到消息 [客户端: %s, 类型: %s]", client.ID, msg.Type)

	switch msg.Type {
	case MessageTypeSyncRequest:
		sm.handleSyncRequest(client, msg)
	case MessageTypeAck:
		sm.handleAck(client, msg)
	case MessageTypePing:
		sm.handlePing(client, msg)
	case MessageTypeTrafficReport:
		sm.handleTrafficReport(client, msg)
	case MessageTypeReportIP:
		sm.handleIPReport(client, msg)
	case "xray_status":
		sm.handleXrayStatus(client, msg)
	default:
		log.Printf("未知消息类型: %s", msg.Type)
	}
}

// handleSyncRequest 处理同步请求
func (sm *SyncManager) handleSyncRequest(client *Client, msg *Message) {
	// 提取本地版本号
	localVersion, ok := msg.Data["local_version"].(float64)
	if !ok {
		sm.sendError(client, "无效的 local_version 字段")
		return
	}

	localVer := int64(localVersion)
	log.Printf("Slave %d 请求同步，本地版本: %d", client.SlaveID, localVer)

	// 获取 Slave 信息
	slave, err := sm.db.GetSlaveByID(client.SlaveID)
	if err != nil {
		sm.sendError(client, fmt.Sprintf("获取 Slave 信息失败: %v", err))
		return
	}

	// 获取最新版本
	latestVersion, err := sm.db.GetLatestVersion(client.SlaveID)
	if err != nil {
		sm.sendError(client, fmt.Sprintf("获取最新版本失败: %v", err))
		return
	}

	log.Printf("Slave %d: 本地版本=%d, 服务器版本=%d, 数据库记录版本=%d",
		client.SlaveID, localVer, latestVersion, slave.CurrentVersion)

	// 如果本地版本已是最新
	if localVer >= latestVersion {
		client.SendMessage(MessageTypeAck, map[string]interface{}{
			"status":  "up_to_date",
			"version": latestVersion,
			"message": "配置已是最新",
		})
		return
	}

	// 获取增量配置
	diffs, err := sm.db.GetConfigDiffs(client.SlaveID, localVer)
	if err != nil {
		sm.sendError(client, fmt.Sprintf("获取配置增量失败: %v", err))
		return
	}

	log.Printf("为 Slave %d 找到 %d 个增量配置", client.SlaveID, len(diffs))

	// 逐个发送增量配置
	for _, diff := range diffs {
		// 解析 JSON 内容
		var content map[string]interface{}
		if err := json.Unmarshal([]byte(diff.Content), &content); err != nil {
			log.Printf("解析配置内容失败: %v", err)
			continue
		}

		// 发送配置增量
		err := client.SendMessage(MessageTypeConfigDiff, map[string]interface{}{
			"version": diff.Version,
			"action":  string(diff.Action),
			"content": content,
		})

		if err != nil {
			log.Printf("发送配置增量失败: %v", err)
			return
		}

		log.Printf("已发送配置增量 [Slave: %d, 版本: %d, 操作: %s]",
			client.SlaveID, diff.Version, diff.Action)
	}

	// 发送同步完成确认
	client.SendMessage(MessageTypeAck, map[string]interface{}{
		"status":        "sync_complete",
		"version":       latestVersion,
		"diffs_applied": len(diffs),
		"message":       fmt.Sprintf("成功同步 %d 个配置增量", len(diffs)),
	})

	// 更新 Slave 的版本号
	if err := sm.db.UpdateSlaveVersion(client.SlaveID, latestVersion); err != nil {
		log.Printf("更新 Slave 版本号失败: %v", err)
	}

	// 更新 Slave 状态为在线
	if err := sm.db.UpdateSlaveStatus(client.SlaveID, model.SlaveStatusOnline); err != nil {
		log.Printf("更新 Slave 状态失败: %v", err)
	}
}

// handleAck 处理确认消息
func (sm *SyncManager) handleAck(client *Client, msg *Message) {
	version, ok := msg.Data["version"].(float64)
	if !ok {
		log.Printf("无效的 ACK 消息")
		return
	}

	log.Printf("Slave %d 确认版本: %d", client.SlaveID, int64(version))

	// 更新数据库中的版本号
	if err := sm.db.UpdateSlaveVersion(client.SlaveID, int64(version)); err != nil {
		log.Printf("更新 Slave 版本号失败: %v", err)
	}
}

// handlePing 处理心跳消息
func (sm *SyncManager) handlePing(client *Client, msg *Message) {
	client.SendMessage(MessageTypePong, map[string]interface{}{
		"timestamp": msg.Timestamp,
	})

	// 更新最后在线时间
	if err := sm.db.UpdateSlaveStatus(client.SlaveID, model.SlaveStatusOnline); err != nil {
		log.Printf("更新 Slave 状态失败: %v", err)
	}
}

// handleIPReport 处理 IP 地址上报
func (sm *SyncManager) handleIPReport(client *Client, msg *Message) {
	ipAddr, ok := msg.Data["ip"].(string)
	if !ok {
		sm.sendError(client, "无效的 IP 地址")
		return
	}

	log.Printf("Slave %d 上报 IP 地址: %s", client.SlaveID, ipAddr)

	// 更新数据库中的 IP 地址
	if err := sm.db.UpdateSlaveIP(client.SlaveID, ipAddr); err != nil {
		log.Printf("更新 Slave IP 失败: %v", err)
		sm.sendError(client, fmt.Sprintf("更新 IP 失败: %v", err))
		return
	}

	// 发送确认消息
	client.SendMessage(MessageTypeAck, map[string]interface{}{
		"status":  "success",
		"message": "IP 地址已更新",
	})
}

// sendError 发送错误消息
func (sm *SyncManager) sendError(client *Client, message string) {
	log.Printf("错误 [客户端: %s]: %s", client.ID, message)
	client.SendMessage(MessageTypeError, map[string]interface{}{
		"error": message,
	})
}

// PushConfigUpdate 主动推送配置更新给指定 Slave
func (sm *SyncManager) PushConfigUpdate(slaveID, version int64, action model.ConfigAction, content string) error {
	// 查找在线的客户端
	client, ok := sm.hub.GetClientBySlaveID(slaveID)
	if !ok {
		return fmt.Errorf("Slave %d 不在线", slaveID)
	}

	// 解析 JSON 内容
	var contentMap map[string]interface{}
	if err := json.Unmarshal([]byte(content), &contentMap); err != nil {
		return fmt.Errorf("解析配置内容失败: %w", err)
	}

	// 发送配置增量
	err := client.SendMessage(MessageTypeConfigDiff, map[string]interface{}{
		"version": version,
		"action":  string(action),
		"content": contentMap,
	})

	if err != nil {
		return fmt.Errorf("发送配置增量失败: %w", err)
	}

	log.Printf("已推送配置更新 [Slave: %d, 版本: %d, 操作: %s]", slaveID, version, action)
	return nil
}

// TriggerSync 主动触发配置同步到指定 Slave
func (sm *SyncManager) TriggerSync(slaveID int64) error {
	// 查找在线的客户端
	client, ok := sm.hub.GetClientBySlaveID(slaveID)
	if !ok {
		return fmt.Errorf("Slave %d 不在线", slaveID)
	}

	// 获取 Slave 的当前版本
	slave, err := sm.db.GetSlaveByID(slaveID)
	if err != nil {
		return fmt.Errorf("获取 Slave 信息失败: %w", err)
	}

	// 获取需要同步的配置差异
	diffs, err := sm.db.GetConfigDiffs(slaveID, slave.CurrentVersion)
	if err != nil {
		return fmt.Errorf("获取配置差异失败: %w", err)
	}

	if len(diffs) == 0 {
		// 配置已是最新
		client.SendMessage(MessageTypeAck, map[string]interface{}{
			"status":  "up_to_date",
			"version": slave.CurrentVersion,
			"message": "配置已是最新",
		})
		return nil
	}

	// 推送所有配置差异
	for _, diff := range diffs {
		var contentMap map[string]interface{}
		if err := json.Unmarshal([]byte(diff.Content), &contentMap); err != nil {
			log.Printf("解析配置内容失败: %v", err)
			continue
		}

		err := client.SendMessage(MessageTypeConfigDiff, map[string]interface{}{
			"version": diff.Version,
			"action":  string(diff.Action),
			"content": contentMap,
		})

		if err != nil {
			return fmt.Errorf("推送配置失败 [版本: %d]: %w", diff.Version, err)
		}

		log.Printf("已推送配置 [Slave: %d, 版本: %d, 操作: %s]", slaveID, diff.Version, diff.Action)
	}

	log.Printf("配置同步已触发 [Slave: %d, 推送了 %d 个配置差异]", slaveID, len(diffs))
	return nil
}

// BroadcastConfigUpdate 广播配置更新给所有在线 Slave
func (sm *SyncManager) BroadcastConfigUpdate(version int64, action model.ConfigAction, content string) {
	// 解析 JSON 内容
	var contentMap map[string]interface{}
	if err := json.Unmarshal([]byte(content), &contentMap); err != nil {
		log.Printf("解析配置内容失败: %v", err)
		return
	}

	message := &Message{
		Type:      MessageTypeConfigDiff,
		Timestamp: 0,
		Data: map[string]interface{}{
			"version": version,
			"action":  string(action),
			"content": contentMap,
		},
	}

	sm.hub.Broadcast(message)
	log.Printf("已广播配置更新 [版本: %d, 操作: %s]", version, action)
}

// handleTrafficReport 处理流量上报
func (sm *SyncManager) handleTrafficReport(client *Client, msg *Message) {
	trafficData, ok := msg.Data["traffic"].(map[string]interface{})
	if !ok {
		log.Printf("无效的流量上报数据")
		return
	}

	log.Printf("收到 Slave %d 的流量上报，包含 %d 个 inbound", client.SlaveID, len(trafficData))

	// 遍历每个 inbound 的流量数据
	for inboundTag, data := range trafficData {
		dataMap, ok := data.(map[string]interface{})
		if !ok {
			log.Printf("无效的流量数据格式: %s", inboundTag)
			continue
		}

		uplink, _ := dataMap["uplink"].(float64)
		downlink, _ := dataMap["downlink"].(float64)

		// 原子更新数据库
		if err := sm.db.UpdateTrafficStats(client.SlaveID, inboundTag, int64(uplink), int64(downlink)); err != nil {
			log.Printf("更新流量统计失败 [Slave: %d, Inbound: %s]: %v", client.SlaveID, inboundTag, err)
		} else {
			log.Printf("流量已更新 [Slave: %d, Inbound: %s, ↑%d ↓%d]", 
				client.SlaveID, inboundTag, int64(uplink), int64(downlink))
		}
	}

	// 发送确认
	client.SendMessage(MessageTypeAck, map[string]interface{}{
		"status":  "traffic_received",
		"message": fmt.Sprintf("已接收 %d 个 inbound 的流量数据", len(trafficData)),
	})
}

// handleXrayStatus 处理 Xray 状态更新
func (sm *SyncManager) handleXrayStatus(client *Client, msg *Message) {
	status, ok := msg.Data["status"].(string)
	if !ok {
		log.Printf("无效的 Xray 状态数据")
		return
	}

	log.Printf("收到 Slave %d 的 Xray 状态: %s", client.SlaveID, status)

	// 更新数据库中的 Xray 状态
	if err := sm.db.UpdateSlaveXrayStatus(client.SlaveID, status); err != nil {
		log.Printf("更新 Xray 状态失败 [Slave: %d]: %v", client.SlaveID, err)
	} else {
		log.Printf("Xray 状态已更新 [Slave: %d, 状态: %s]", client.SlaveID, status)
	}
}
