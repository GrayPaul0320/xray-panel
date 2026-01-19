package handler

import (
	"log"
	"net/http"
	"time"

	"github.com/graypaul/xray-panel/internal/model"
)

// SystemHandler 处理系统管理相关的 HTTP 请求
type SystemHandler struct {
	db *model.DB
}

// NewSystemHandler 创建系统处理器
func NewSystemHandler(db *model.DB) *SystemHandler {
	return &SystemHandler{db: db}
}

// HealthResponse 健康检查响应
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
	Database  string    `json:"database"`
}

// LogEntry 日志条目
type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

// HandleHealthCheck 处理健康检查
// GET /api/system/health
func (h *SystemHandler) HandleHealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 检查数据库连接
	dbStatus := "healthy"
	if err := h.db.Ping(); err != nil {
		dbStatus = "unhealthy"
		log.Printf("[SystemHandler] 数据库健康检查失败: %v", err)
	}

	response := HealthResponse{
		Status:    "running",
		Timestamp: time.Now(),
		Version:   "1.0.0",
		Database:  dbStatus,
	}

	WriteSuccess(w, response)
}

// HandleGetSystemLogs 处理获取系统日志
// GET /api/system/logs
func (h *SystemHandler) HandleGetSystemLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 获取查询参数
	// limit := r.URL.Query().Get("limit")
	// level := r.URL.Query().Get("level")

	// 生成模拟日志（实际应从日志文件或数据库读取）
	logs := []LogEntry{
		{
			Time:    time.Now().Add(-5 * time.Minute).Format("2006-01-02 15:04:05"),
			Level:   "info",
			Message: "Slave [node-01] 已连接",
		},
		{
			Time:    time.Now().Add(-10 * time.Minute).Format("2006-01-02 15:04:05"),
			Level:   "success",
			Message: "配置同步成功: Slave ID 1, Version 5",
		},
		{
			Time:    time.Now().Add(-15 * time.Minute).Format("2006-01-02 15:04:05"),
			Level:   "warning",
			Message: "Slave [node-02] 心跳超时",
		},
		{
			Time:    time.Now().Add(-20 * time.Minute).Format("2006-01-02 15:04:05"),
			Level:   "info",
			Message: "新增 Inbound 配置: vless-443",
		},
		{
			Time:    time.Now().Add(-25 * time.Minute).Format("2006-01-02 15:04:05"),
			Level:   "error",
			Message: "流量统计更新失败: Slave ID 3",
		},
		{
			Time:    time.Now().Add(-30 * time.Minute).Format("2006-01-02 15:04:05"),
			Level:   "info",
			Message: "Master 节点启动成功",
		},
	}

	WriteSuccess(w, map[string]interface{}{
		"logs":  logs,
		"total": len(logs),
	})
}

// Router 路由分发器
func (h *SystemHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// GET /api/system/health
	if path == "/api/system/health" && r.Method == http.MethodGet {
		h.HandleHealthCheck(w, r)
		return
	}

	// GET /api/system/logs
	if path == "/api/system/logs" && r.Method == http.MethodGet {
		h.HandleGetSystemLogs(w, r)
		return
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}
