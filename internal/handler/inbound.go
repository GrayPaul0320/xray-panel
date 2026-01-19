package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/graypaul/xray-panel/internal/comm"
	"github.com/graypaul/xray-panel/internal/model"
)

// InboundHandler 处理 Inbound 相关的 HTTP 请求
type InboundHandler struct {
	db          *model.DB
	syncManager *comm.SyncManager
	hub         *comm.Hub
}

// NewInboundHandler 创建 Inbound 处理器
func NewInboundHandler(db *model.DB, syncManager *comm.SyncManager, hub *comm.Hub) *InboundHandler {
	return &InboundHandler{
		db:          db,
		syncManager: syncManager,
		hub:         hub,
	}
}

// InboundConfig Inbound 配置结构
type InboundConfig struct {
	Tag      string                 `json:"tag"`
	Protocol string                 `json:"protocol"`
	Port     int                    `json:"port"`
	Listen   string                 `json:"listen"`
	Settings map[string]interface{} `json:"settings"`
	// 其他 Xray 配置字段...
}

// InboundResponse Inbound 响应结构
type InboundResponse struct {
	ID          int64                  `json:"id"`
	SlaveID     int64                  `json:"slave_id"`
	Tag         string                 `json:"tag"`
	Protocol    string                 `json:"protocol"`
	Port        int                    `json:"port"`
	Config      map[string]interface{} `json:"config"`
	Status      string                 `json:"status"`
	LastUpdated string                 `json:"last_updated"`
}

// HandleListInbounds 处理获取 Inbound 列表
// GET /api/slaves/:id/inbounds
func (h *InboundHandler) HandleListInbounds(w http.ResponseWriter, r *http.Request, slaveID int64) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	_, err := h.db.GetSlaveByID(slaveID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	// 获取该 Slave 的所有 inbound 配置差异
	diffs, err := h.db.GetConfigDiffsByType(slaveID, "inbound", 0)
	if err != nil {
		log.Printf("[InboundHandler] 获取配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取配置失败")
		return
	}

	// 构建当前的 Inbound 列表（通过 diff 重建）
	inbounds := make(map[string]*InboundResponse)
	for _, diff := range diffs {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(diff.Content), &config); err != nil {
			log.Printf("[InboundHandler] 解析配置失败: %v", err)
			continue
		}

		tag, _ := config["tag"].(string)
		
		switch diff.Action {
		case model.ConfigActionAdd, model.ConfigActionUpdate:
			inbounds[tag] = &InboundResponse{
				ID:          diff.ID,
				SlaveID:     slaveID,
				Tag:         tag,
				Protocol:    getString(config, "protocol"),
				Port:        int(getFloat64(config, "port")),
				Config:      config,
				Status:      "active",
				LastUpdated: diff.CreatedAt.Format("2006-01-02 15:04:05"),
			}
		case model.ConfigActionDelete:
			delete(inbounds, tag)
		}
	}

	// 转换为数组
	response := make([]InboundResponse, 0, len(inbounds))
	for _, inbound := range inbounds {
		response = append(response, *inbound)
	}

	WriteSuccess(w, map[string]interface{}{
		"inbounds": response,
		"total":    len(response),
	})
}

// HandleCreateInbound 处理创建 Inbound
// POST /api/slaves/:id/inbounds
func (h *InboundHandler) HandleCreateInbound(w http.ResponseWriter, r *http.Request, slaveID int64) {
	if r.Method != http.MethodPost {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	_, err := h.db.GetSlaveByID(slaveID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	var config map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		WriteError(w, http.StatusBadRequest, "无效的配置数据")
		return
	}

	// 验证必需字段
	tag, ok := config["tag"].(string)
	if !ok || tag == "" {
		WriteError(w, http.StatusBadRequest, "tag 字段不能为空")
		return
	}

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[InboundHandler] 获取版本号失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取版本号失败")
		return
	}
	newVersion := latestVersion + 1

	// 序列化配置
	configJSON, err := json.Marshal(config)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "配置序列化失败")
		return
	}

	// 创建配置差异记录
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "inbound", model.ConfigActionAdd, string(configJSON)); err != nil {
		log.Printf("[InboundHandler] 创建配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "创建配置失败")
		return
	}

	log.Printf("[InboundHandler] 创建 Inbound 成功: SlaveID=%d, Tag=%s, Version=%d", slaveID, tag, newVersion)

	WriteCreated(w, map[string]interface{}{
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
		"message":  "配置已添加，请推送到 Slave",
	})
}

// HandleUpdateInbound 处理更新 Inbound
// PUT /api/slaves/:id/inbounds/:inboundId
func (h *InboundHandler) HandleUpdateInbound(w http.ResponseWriter, r *http.Request, slaveID, inboundID int64) {
	if r.Method != http.MethodPut {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	_, err := h.db.GetSlaveByID(slaveID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	var config map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		WriteError(w, http.StatusBadRequest, "无效的配置数据")
		return
	}

	// 验证必需字段
	tag, ok := config["tag"].(string)
	if !ok || tag == "" {
		WriteError(w, http.StatusBadRequest, "tag 字段不能为空")
		return
	}

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[InboundHandler] 获取版本号失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取版本号失败")
		return
	}
	newVersion := latestVersion + 1

	// 序列化配置
	configJSON, err := json.Marshal(config)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "配置序列化失败")
		return
	}

	// 创建更新差异记录
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "inbound", model.ConfigActionUpdate, string(configJSON)); err != nil {
		log.Printf("[InboundHandler] 更新配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "更新配置失败")
		return
	}

	log.Printf("[InboundHandler] 更新 Inbound 成功: SlaveID=%d, Tag=%s, Version=%d", slaveID, tag, newVersion)

	WriteSuccess(w, map[string]interface{}{
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
		"message":  "配置已更新，请推送到 Slave",
	})
}

// HandleDeleteInbound 处理删除 Inbound
// DELETE /api/slaves/:id/inbounds/:inboundId
func (h *InboundHandler) HandleDeleteInbound(w http.ResponseWriter, r *http.Request, slaveID, inboundID int64) {
	if r.Method != http.MethodDelete {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	_, err := h.db.GetSlaveByID(slaveID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	// 从查询参数获取 tag
	tag := r.URL.Query().Get("tag")
	if tag == "" {
		WriteError(w, http.StatusBadRequest, "tag 参数不能为空")
		return
	}

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[InboundHandler] 获取版本号失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取版本号失败")
		return
	}
	newVersion := latestVersion + 1

	// 创建删除差异记录
	deleteConfig := map[string]interface{}{"tag": tag}
	configJSON, _ := json.Marshal(deleteConfig)
	
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "inbound", model.ConfigActionDelete, string(configJSON)); err != nil {
		log.Printf("[InboundHandler] 删除配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "删除配置失败")
		return
	}

	log.Printf("[InboundHandler] 删除 Inbound 成功: SlaveID=%d, Tag=%s, Version=%d", slaveID, tag, newVersion)

	WriteNoContent(w)
}

// HandlePushConfig 处理推送配置到 Slave
// POST /api/slaves/:id/inbounds/push
func (h *InboundHandler) HandlePushConfig(w http.ResponseWriter, r *http.Request, slaveID int64) {
	if r.Method != http.MethodPost {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	slave, err := h.db.GetSlaveByID(slaveID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	// 检查 Slave 是否在线
	if slave.Status != model.SlaveStatusOnline {
		WriteError(w, http.StatusBadRequest, "Slave 离线，无法推送配置")
		return
	}

	// 获取最新版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[InboundHandler] 获取版本号失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取版本号失败")
		return
	}

	// 触发配置同步（通过 WebSocket）
	if h.syncManager != nil {
		log.Printf("[InboundHandler] 触发配置推送: SlaveID=%d, Version=%d", slaveID, latestVersion)
		if err := h.syncManager.TriggerSync(slaveID); err != nil {
			log.Printf("[InboundHandler] 配置推送失败: %v", err)
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("配置推送失败: %v", err))
			return
		}
	}

	WriteSuccess(w, map[string]interface{}{
		"slave_id": slaveID,
		"version":  latestVersion,
		"message":  "配置推送成功",
	})
}

// Router 路由分发器
func (h *InboundHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 处理 /api/slaves/:id/inbounds
	if strings.HasPrefix(path, "/api/slaves/") {
		parts := strings.Split(strings.TrimPrefix(path, "/api/slaves/"), "/")
		if len(parts) < 2 {
			WriteError(w, http.StatusBadRequest, "无效的请求路径")
			return
		}

		slaveID, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "无效的 Slave ID")
			return
		}

		// GET /api/slaves/:id/inbounds
		if len(parts) == 2 && parts[1] == "inbounds" && r.Method == http.MethodGet {
			h.HandleListInbounds(w, r, slaveID)
			return
		}

		// POST /api/slaves/:id/inbounds
		if len(parts) == 2 && parts[1] == "inbounds" && r.Method == http.MethodPost {
			h.HandleCreateInbound(w, r, slaveID)
			return
		}

		// POST /api/slaves/:id/inbounds/push
		if len(parts) == 3 && parts[1] == "inbounds" && parts[2] == "push" && r.Method == http.MethodPost {
			h.HandlePushConfig(w, r, slaveID)
			return
		}

		// PUT /api/slaves/:id/inbounds/:inboundId
		if len(parts) == 3 && parts[1] == "inbounds" && r.Method == http.MethodPut {
			inboundID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Inbound ID")
				return
			}
			h.HandleUpdateInbound(w, r, slaveID, inboundID)
			return
		}

		// DELETE /api/slaves/:id/inbounds/:inboundId
		if len(parts) == 3 && parts[1] == "inbounds" && r.Method == http.MethodDelete {
			inboundID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Inbound ID")
				return
			}
			h.HandleDeleteInbound(w, r, slaveID, inboundID)
			return
		}
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}

// Helper functions
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat64(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}
