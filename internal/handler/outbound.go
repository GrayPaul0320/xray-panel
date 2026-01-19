package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/graypaul/xray-panel/internal/comm"
	"github.com/graypaul/xray-panel/internal/model"
)

// OutboundHandler 处理 Outbound 相关的 HTTP 请求
type OutboundHandler struct {
	db          *model.DB
	syncManager *comm.SyncManager
	hub         *comm.Hub
}

// NewOutboundHandler 创建 Outbound 处理器
func NewOutboundHandler(db *model.DB, syncManager *comm.SyncManager, hub *comm.Hub) *OutboundHandler {
	return &OutboundHandler{
		db:          db,
		syncManager: syncManager,
		hub:         hub,
	}
}

// OutboundResponse Outbound 响应结构
type OutboundResponse struct {
	ID          int64                  `json:"id"`
	SlaveID     int64                  `json:"slave_id"`
	Tag         string                 `json:"tag"`
	Protocol    string                 `json:"protocol"`
	Config      map[string]interface{} `json:"config"`
	Status      string                 `json:"status"`
	LastUpdated string                 `json:"last_updated"`
}

// HandleListOutbounds 处理获取 Outbound 列表
// GET /api/slaves/:id/outbounds
func (h *OutboundHandler) HandleListOutbounds(w http.ResponseWriter, r *http.Request, slaveID int64) {
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

	// 获取该 Slave 的所有 Outbound 配置差异
	diffs, err := h.db.GetConfigDiffsByType(slaveID, "outbound", 0)
	if err != nil {
		log.Printf("[OutboundHandler] 获取配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取配置失败")
		return
	}

	// 构建当前的 Outbound 列表
	outbounds := make(map[string]*OutboundResponse)
	for _, diff := range diffs {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(diff.Content), &config); err != nil {
			continue
		}

		tag, _ := config["tag"].(string)
		protocol, _ := config["protocol"].(string)

		switch diff.Action {
		case model.ConfigActionAdd, model.ConfigActionUpdate:
			outbounds[tag] = &OutboundResponse{
				ID:          diff.ID,
				SlaveID:     slaveID,
				Tag:         tag,
				Protocol:    protocol,
				Config:      config,
				Status:      "active",
				LastUpdated: diff.CreatedAt.Format("2006-01-02 15:04:05"),
			}
		case model.ConfigActionDelete:
			delete(outbounds, tag)
		}
	}

	// 转换为数组
	response := make([]OutboundResponse, 0, len(outbounds))
	for _, outbound := range outbounds {
		response = append(response, *outbound)
	}

	WriteSuccess(w, map[string]interface{}{
		"outbounds": response,
		"total":     len(response),
	})
}

// HandleCreateOutbound 处理创建 Outbound
// POST /api/slaves/:id/outbounds
func (h *OutboundHandler) HandleCreateOutbound(w http.ResponseWriter, r *http.Request, slaveID int64) {
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

	protocol, ok := config["protocol"].(string)
	if !ok || protocol == "" {
		WriteError(w, http.StatusBadRequest, "protocol 字段不能为空")
		return
	}

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[OutboundHandler] 获取版本号失败: %v", err)
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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "outbound", model.ConfigActionAdd, string(configJSON)); err != nil {
		log.Printf("[OutboundHandler] 创建配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "创建配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":  "Outbound 已添加，请推送到 Slave",
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
	})
}

// HandleUpdateOutbound 处理更新 Outbound
// PUT /api/slaves/:id/outbounds/:outboundId
func (h *OutboundHandler) HandleUpdateOutbound(w http.ResponseWriter, r *http.Request, slaveID, outboundID int64) {
	if r.Method != http.MethodPut {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	var config map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		WriteError(w, http.StatusBadRequest, "无效的配置数据")
		return
	}

	tag, ok := config["tag"].(string)
	if !ok || tag == "" {
		WriteError(w, http.StatusBadRequest, "tag 字段不能为空")
		return
	}

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "outbound", model.ConfigActionUpdate, string(configJSON)); err != nil {
		WriteError(w, http.StatusInternalServerError, "更新配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":  "Outbound 已更新，请推送到 Slave",
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
	})
}

// HandleDeleteOutbound 处理删除 Outbound
// DELETE /api/slaves/:id/outbounds/:outboundId
func (h *OutboundHandler) HandleDeleteOutbound(w http.ResponseWriter, r *http.Request, slaveID, outboundID int64) {
	if r.Method != http.MethodDelete {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 获取要删除的配置
	diff, err := h.db.GetConfigDiffByID(outboundID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "配置不存在")
		return
	}

	var config map[string]interface{}
	if err := json.Unmarshal([]byte(diff.Content), &config); err != nil {
		WriteError(w, http.StatusInternalServerError, "解析配置失败")
		return
	}

	tag, _ := config["tag"].(string)

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "获取版本号失败")
		return
	}
	newVersion := latestVersion + 1

	// 创建删除差异记录
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "outbound", model.ConfigActionDelete, diff.Content); err != nil {
		WriteError(w, http.StatusInternalServerError, "删除配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":  "Outbound 已删除，请推送到 Slave",
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
	})
}

// Router 路由分发器
func (h *OutboundHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 处理 /api/slaves/:id/outbounds
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

		// GET /api/slaves/:id/outbounds
		if len(parts) == 2 && parts[1] == "outbounds" && r.Method == http.MethodGet {
			h.HandleListOutbounds(w, r, slaveID)
			return
		}

		// POST /api/slaves/:id/outbounds
		if len(parts) == 2 && parts[1] == "outbounds" && r.Method == http.MethodPost {
			h.HandleCreateOutbound(w, r, slaveID)
			return
		}

		// PUT /api/slaves/:id/outbounds/:outboundId
		if len(parts) == 3 && parts[1] == "outbounds" && r.Method == http.MethodPut {
			outboundID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Outbound ID")
				return
			}
			h.HandleUpdateOutbound(w, r, slaveID, outboundID)
			return
		}

		// DELETE /api/slaves/:id/outbounds/:outboundId
		if len(parts) == 3 && parts[1] == "outbounds" && r.Method == http.MethodDelete {
			outboundID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Outbound ID")
				return
			}
			h.HandleDeleteOutbound(w, r, slaveID, outboundID)
			return
		}
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}
