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

// BalancerHandler 处理负载均衡器相关的 HTTP 请求
type BalancerHandler struct {
	db          *model.DB
	syncManager *comm.SyncManager
	hub         *comm.Hub
}

// NewBalancerHandler 创建负载均衡器处理器
func NewBalancerHandler(db *model.DB, syncManager *comm.SyncManager, hub *comm.Hub) *BalancerHandler {
	return &BalancerHandler{
		db:          db,
		syncManager: syncManager,
		hub:         hub,
	}
}

// BalancerResponse 负载均衡器响应结构
type BalancerResponse struct {
	ID          int64                  `json:"id"`
	SlaveID     int64                  `json:"slave_id"`
	Tag         string                 `json:"tag"`
	Selector    []string               `json:"selector"`
	Strategy    string                 `json:"strategy"`
	Config      map[string]interface{} `json:"config"`
	Status      string                 `json:"status"`
	LastUpdated string                 `json:"last_updated"`
}

// HandleListBalancers 处理获取负载均衡器列表
// GET /api/slaves/:id/balancers
func (h *BalancerHandler) HandleListBalancers(w http.ResponseWriter, r *http.Request, slaveID int64) {
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

	// 获取该 Slave 的所有 balancer 配置差异
	diffs, err := h.db.GetConfigDiffsByType(slaveID, "balancer", 0)
	if err != nil {
		log.Printf("[BalancerHandler] 获取配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取配置失败")
		return
	}

	// 构建当前的负载均衡器列表
	balancers := make(map[string]*BalancerResponse)
	for _, diff := range diffs {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(diff.Content), &config); err != nil {
			continue
		}

		selectorRaw, _ := config["selector"]

		tag, _ := config["tag"].(string)
		strategy, _ := config["strategy"].(string)

		// 转换 selector
		var selector []string
		if selectorArr, ok := selectorRaw.([]interface{}); ok {
			for _, item := range selectorArr {
				if str, ok := item.(string); ok {
					selector = append(selector, str)
				}
			}
		}

		switch diff.Action {
		case model.ConfigActionAdd, model.ConfigActionUpdate:
			balancers[tag] = &BalancerResponse{
				ID:          diff.ID,
				SlaveID:     slaveID,
				Tag:         tag,
				Selector:    selector,
				Strategy:    strategy,
				Config:      config,
				Status:      "active",
				LastUpdated: diff.CreatedAt.Format("2006-01-02 15:04:05"),
			}
		case model.ConfigActionDelete:
			delete(balancers, tag)
		}
	}

	// 转换为数组
	response := make([]BalancerResponse, 0, len(balancers))
	for _, balancer := range balancers {
		response = append(response, *balancer)
	}

	WriteSuccess(w, map[string]interface{}{
		"balancers": response,
		"total":     len(response),
	})
}

// HandleCreateBalancer 处理创建负载均衡器
// POST /api/slaves/:id/balancers
func (h *BalancerHandler) HandleCreateBalancer(w http.ResponseWriter, r *http.Request, slaveID int64) {
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

	_, hasSelector := config["selector"]
	if !hasSelector {
		WriteError(w, http.StatusBadRequest, "selector 字段不能为空")
		return
	}

	// 获取下一个版本号
	latestVersion, err := h.db.GetLatestVersion(slaveID)
	if err != nil {
		log.Printf("[BalancerHandler] 获取版本号失败: %v", err)
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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "balancer", model.ConfigActionAdd, string(configJSON)); err != nil {
		log.Printf("[BalancerHandler] 创建配置失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "创建配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":  "负载均衡器已添加，请推送到 Slave",
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
	})
}

// HandleUpdateBalancer 处理更新负载均衡器
// PUT /api/slaves/:id/balancers/:balancerId
func (h *BalancerHandler) HandleUpdateBalancer(w http.ResponseWriter, r *http.Request, slaveID, balancerID int64) {
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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "balancer", model.ConfigActionUpdate, string(configJSON)); err != nil {
		WriteError(w, http.StatusInternalServerError, "更新配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":  "负载均衡器已更新，请推送到 Slave",
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
	})
}

// HandleDeleteBalancer 处理删除负载均衡器
// DELETE /api/slaves/:id/balancers/:balancerId
func (h *BalancerHandler) HandleDeleteBalancer(w http.ResponseWriter, r *http.Request, slaveID, balancerID int64) {
	if r.Method != http.MethodDelete {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 获取要删除的配置
	diff, err := h.db.GetConfigDiffByID(balancerID)
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
	if err := h.db.CreateConfigDiff(slaveID, newVersion, "balancer", model.ConfigActionDelete, diff.Content); err != nil {
		WriteError(w, http.StatusInternalServerError, "删除配置失败")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"message":  "负载均衡器已删除，请推送到 Slave",
		"slave_id": slaveID,
		"tag":      tag,
		"version":  newVersion,
	})
}

// Router 路由分发器
func (h *BalancerHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 处理 /api/slaves/:id/balancers
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

		// GET /api/slaves/:id/balancers
		if len(parts) == 2 && parts[1] == "balancers" && r.Method == http.MethodGet {
			h.HandleListBalancers(w, r, slaveID)
			return
		}

		// POST /api/slaves/:id/balancers
		if len(parts) == 2 && parts[1] == "balancers" && r.Method == http.MethodPost {
			h.HandleCreateBalancer(w, r, slaveID)
			return
		}

		// PUT /api/slaves/:id/balancers/:balancerId
		if len(parts) == 3 && parts[1] == "balancers" && r.Method == http.MethodPut {
			balancerID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Balancer ID")
				return
			}
			h.HandleUpdateBalancer(w, r, slaveID, balancerID)
			return
		}

		// DELETE /api/slaves/:id/balancers/:balancerId
		if len(parts) == 3 && parts[1] == "balancers" && r.Method == http.MethodDelete {
			balancerID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				WriteError(w, http.StatusBadRequest, "无效的 Balancer ID")
				return
			}
			h.HandleDeleteBalancer(w, r, slaveID, balancerID)
			return
		}
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}
