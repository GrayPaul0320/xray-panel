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

// RoutingHandler 处理路由规则相关的 HTTP 请求
type RoutingHandler struct {
	db          *model.DB
	syncManager *comm.SyncManager
	hub         *comm.Hub
}

// NewRoutingHandler 创建路由处理器
func NewRoutingHandler(db *model.DB, syncManager *comm.SyncManager, hub *comm.Hub) *RoutingHandler {
	return &RoutingHandler{
		db:          db,
		syncManager: syncManager,
		hub:         hub,
	}
}

// RoutingRuleResponse 路由规则响应结构
type RoutingRuleResponse struct {
	ID          int64                  `json:"id"`
	SlaveID     int64                  `json:"slave_id"`
	OutboundTag string                 `json:"outbound_tag"`
	Config      map[string]interface{} `json:"config"`
	Status      string                 `json:"status"`
	LastUpdated string                 `json:"last_updated"`
}

// HandleListRoutingRules 处理获取路由规则列表
// GET /api/slaves/:id/routing
func (h *RoutingHandler) HandleListRoutingRules(w http.ResponseWriter, r *http.Request, slaveID int64) {
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

	// 获取该 Slave 的所有 routing 配置差异
	diffs, err := h.db.GetConfigDiffsByType(slaveID, "routing", 0)
	if err != nil {
		log.Printf("[RoutingHandler] 获取配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取配置失败")
		return
	}

	// 构建当前的路由规则列表
	rules := make(map[string]*RoutingRuleResponse)
	for _, diff := range diffs {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(diff.Content), &config); err != nil {
			continue
		}

		outboundTag, _ := config["outboundTag"].(string)

		switch diff.Action {
		case model.ConfigActionAdd, model.ConfigActionUpdate:
			rules[outboundTag] = &RoutingRuleResponse{
				ID:          diff.ID,
				SlaveID:     slaveID,
				OutboundTag: outboundTag,
				Config:      config,
				Status:      "active",
				LastUpdated: diff.CreatedAt.Format("2006-01-02 15:04:05"),
			}
		case model.ConfigActionDelete:
			delete(rules, outboundTag)
		}
	}

	// 转换为数组
	response := make([]RoutingRuleResponse, 0, len(rules))
	for _, rule := range rules {
		response = append(response, *rule)
	}

	WriteSuccess(w, map[string]interface{}{
		"rules": response,
		"total": len(response),
	})
}

// HandleCreateRoutingRule 处理创建路由规则
// POST /api/slaves/:id/routing
func (h *RoutingHandler) HandleCreateRoutingRule(w http.ResponseWriter, r *http.Request, slaveID int64) {
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
	outboundTag, ok := config["outboundTag"].(string)
	if !ok || outboundTag == "" {
		WriteError(w, http.StatusBadRequest, "outboundTag 字段不能为空")
		return
	}

	// 添加 tag 字段（用于标识）
	config["tag"] = "rule-" + outboundTag

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[RoutingHandler] 获取版本号失败: %v", err)
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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "routing", model.ConfigActionAdd, string(configJSON)); err != nil {
		log.Printf("[RoutingHandler] 创建配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "创建配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":      "路由规则已添加，请推送到 Slave",
		"slave_id":     slaveID,
		"outbound_tag": outboundTag,
		"version":      newVersion,
	})
}

// HandleUpdateRoutingRule 处理更新路由规则
// PUT /api/slaves/:id/routing/:ruleId
func (h *RoutingHandler) HandleUpdateRoutingRule(w http.ResponseWriter, r *http.Request, slaveID, ruleID int64) {
	if r.Method != http.MethodPut {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	var config map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		WriteError(w, http.StatusBadRequest, "无效的配置数据")
		return
	}

	outboundTag, ok := config["outboundTag"].(string)
	if !ok || outboundTag == "" {
		WriteError(w, http.StatusBadRequest, "outboundTag 字段不能为空")
		return
	}

	// 添加 tag 字段
	config["tag"] = "rule-" + outboundTag

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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "routing", model.ConfigActionUpdate, string(configJSON)); err != nil {
		WriteError(w, http.StatusInternalServerError, "更新配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":      "路由规则已更新，请推送到 Slave",
		"slave_id":     slaveID,
		"outbound_tag": outboundTag,
		"version":      newVersion,
	})
}

// HandleDeleteRoutingRule 处理删除路由规则
// DELETE /api/slaves/:id/routing/:ruleId
func (h *RoutingHandler) HandleDeleteRoutingRule(w http.ResponseWriter, r *http.Request, slaveID, ruleID int64) {
	if r.Method != http.MethodDelete {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 获取要删除的配置
	diff, err := h.db.GetConfigDiffByID(ruleID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "配置不存在")
		return
	}

	var config map[string]interface{}
	if err := json.Unmarshal([]byte(diff.Content), &config); err != nil {
		WriteError(w, http.StatusInternalServerError, "解析配置失败")
		return
	}

	outboundTag, _ := config["outboundTag"].(string)

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "获取版本号失败")
		return
	}
	newVersion := latestVersion + 1

	// 创建删除差异记录
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "routing", model.ConfigActionDelete, diff.Content); err != nil {
		WriteError(w, http.StatusInternalServerError, "删除配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":      "路由规则已删除，请推送到 Slave",
		"slave_id":     slaveID,
		"outbound_tag": outboundTag,
		"version":      newVersion,
	})
}

// Router 路由分发器
func (h *RoutingHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 处理 /api/slaves/:id/routing
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

		// GET /api/slaves/:id/routing
		if len(parts) == 2 && parts[1] == "routing" && r.Method == http.MethodGet {
			h.HandleListRoutingRules(w, r, slaveID)
			return
		}

		// POST /api/slaves/:id/routing
		if len(parts) == 2 && parts[1] == "routing" && r.Method == http.MethodPost {
			h.HandleCreateRoutingRule(w, r, slaveID)
			return
		}

		// PUT /api/slaves/:id/routing/:ruleId
		if len(parts) == 3 && parts[1] == "routing" && r.Method == http.MethodPut {
			ruleID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Rule ID")
				return
			}
			h.HandleUpdateRoutingRule(w, r, slaveID, ruleID)
			return
		}

		// DELETE /api/slaves/:id/routing/:ruleId
		if len(parts) == 3 && parts[1] == "routing" && r.Method == http.MethodDelete {
			ruleID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Rule ID")
				return
			}
			h.HandleDeleteRoutingRule(w, r, slaveID, ruleID)
			return
		}
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}
