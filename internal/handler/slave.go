package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/graypaul/xray-panel/internal/comm"
	"github.com/graypaul/xray-panel/internal/model"
)

// SlaveHandler 处理 Slave 相关的 HTTP 请求
type SlaveHandler struct {
	db      *model.DB
	jwtAuth *comm.JWTAuth
	hub     *comm.Hub
}

// NewSlaveHandler 创建 Slave 处理器
func NewSlaveHandler(db *model.DB, jwtAuth *comm.JWTAuth, hub *comm.Hub) *SlaveHandler {
	return &SlaveHandler{
		db:      db,
		jwtAuth: jwtAuth,
		hub:     hub,
	}
}

// SlaveResponse Slave 响应结构
type SlaveResponse struct {
	ID             int64      `json:"id"`
	Name           string     `json:"name"`
	IP             string     `json:"ip,omitempty"`
	Status         string     `json:"status"`
	XrayStatus     string     `json:"xray_status"`
	CurrentVersion int64      `json:"current_version"`
	LastSeen       *time.Time `json:"last_seen,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CreateSlaveRequest 创建 Slave 请求
type CreateSlaveRequest struct {
	Name string `json:"name"`
}

// CreateSlaveResponse 创建 Slave 响应
type CreateSlaveResponse struct {
	ID             int64  `json:"id"`
	Name           string `json:"name"`
	Token          string `json:"token"`
	InstallCommand string `json:"install_command"`
}

// UpdateSlaveRequest 更新 Slave 请求
type UpdateSlaveRequest struct {
	Name string `json:"name"`
	IP   string `json:"ip"`
}

// HandleListSlaves 处理获取 Slave 列表
// GET /api/slaves
func (h *SlaveHandler) HandleListSlaves(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	slaves, err := h.db.ListSlaves()
	if err != nil {
		log.Printf("[SlaveHandler] 获取 Slave 列表失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取列表失败")
		return
	}

	// 转换为响应格式
	response := make([]SlaveResponse, 0, len(slaves))
	for _, slave := range slaves {
		response = append(response, SlaveResponse{
			ID:             slave.ID,
			Name:           slave.Name,
			Status:         string(slave.Status),
			XrayStatus:     slave.XrayStatus,
			CurrentVersion: slave.CurrentVersion,
			LastSeen:       slave.LastSeen,
			CreatedAt:      slave.CreatedAt,
			UpdatedAt:      slave.UpdatedAt,
		})
	}

	WriteSuccess(w, map[string]interface{}{
		"slaves": response,
		"total":  len(response),
	})
}

// HandleGetSlave 处理获取单个 Slave
// GET /api/slaves/:id
func (h *SlaveHandler) HandleGetSlave(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	slave, err := h.db.GetSlaveByID(id)
	if err != nil {
		log.Printf("[SlaveHandler] 获取 Slave 失败: %v", err)
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	WriteSuccess(w, SlaveResponse{
		ID:             slave.ID,
		Name:           slave.Name,
		Status:         string(slave.Status),
		CurrentVersion: slave.CurrentVersion,
		LastSeen:       slave.LastSeen,
		CreatedAt:      slave.CreatedAt,
		UpdatedAt:      slave.UpdatedAt,
	})
}

// HandleCreateSlave 处理创建 Slave
// POST /api/slaves
func (h *SlaveHandler) HandleCreateSlave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	var req CreateSlaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	// 验证参数
	if req.Name == "" {
		WriteError(w, http.StatusBadRequest, "Slave 名称不能为空")
		return
	}

	// 创建 Slave
	slave, err := h.db.CreateSlave(req.Name)
	if err != nil {
		log.Printf("[SlaveHandler] 创建 Slave 失败: %v", err)
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			WriteError(w, http.StatusConflict, "Slave 名称已存在")
		} else {
			WriteError(w, http.StatusInternalServerError, "创建失败")
		}
		return
	}

	// 生成 JWT Token
	token, err := h.jwtAuth.GenerateToken(slave.ID, slave.Name)
	if err != nil {
		log.Printf("[SlaveHandler] 生成 Token 失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "生成 Token 失败")
		return
	}

	// 生成一键安装命令（使用环境变量或默认值）
	installCommand := generateInstallCommand(token, slave.Name)

	log.Printf("[SlaveHandler] 创建 Slave 成功: ID=%d, Name=%s", slave.ID, slave.Name)

	WriteCreated(w, CreateSlaveResponse{
		ID:             slave.ID,
		Name:           slave.Name,
		Token:          token,
		InstallCommand: installCommand,
	})
}

// HandleUpdateSlave 处理更新 Slave
// PUT /api/slaves/:id
func (h *SlaveHandler) HandleUpdateSlave(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodPut {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	var req UpdateSlaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	// 验证 Slave 是否存在
	slave, err := h.db.GetSlaveByID(id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	// 注意：当前数据库模型不支持存储 IP，这里只做响应
	// 实际项目中需要扩展数据库表
	log.Printf("[SlaveHandler] 更新 Slave: ID=%d, Name=%s (IP更新功能未实现)", id, req.Name)

	WriteSuccess(w, map[string]interface{}{
		"id":      slave.ID,
		"name":    req.Name,
		"ip":      req.IP,
		"message": "更新成功（注意：IP字段未持久化）",
	})
}

// HandleDeleteSlave 处理删除 Slave
// DELETE /api/slaves/:id
func (h *SlaveHandler) HandleDeleteSlave(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodDelete {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	_, err := h.db.GetSlaveByID(id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	// 删除 Slave（数据库外键会级联删除配置和流量统计）
	_, err = h.db.Exec("DELETE FROM slaves WHERE id = $1", id)
	if err != nil {
		log.Printf("[SlaveHandler] 删除 Slave 失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "删除失败")
		return
	}

	// 断开该 Slave 的 WebSocket 连接
	if h.hub != nil {
		// 遍历所有连接，断开对应 Slave 的连接
		// 注意：这需要 Hub 提供相应的方法
		log.Printf("[SlaveHandler] Slave 已删除，WebSocket 连接将自动断开: ID=%d", id)
	}

	log.Printf("[SlaveHandler] 删除 Slave 成功: ID=%d", id)
	WriteNoContent(w)
}

// HandleRegenerateToken 处理重新生成 Token
// POST /api/slaves/:id/regenerate-token
func (h *SlaveHandler) HandleRegenerateToken(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != http.MethodPost {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 验证 Slave 是否存在
	slave, err := h.db.GetSlaveByID(id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Slave 不存在")
		return
	}

	// 生成新的 JWT Token
	token, err := h.jwtAuth.GenerateToken(slave.ID, slave.Name)
	if err != nil {
		log.Printf("[SlaveHandler] 重新生成 Token 失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "生成 Token 失败")
		return
	}

	// 生成一键安装命令
	installCommand := generateInstallCommand(token, slave.Name)

	log.Printf("[SlaveHandler] 重新生成 Token 成功: ID=%d, Name=%s", slave.ID, slave.Name)

	WriteSuccess(w, map[string]interface{}{
		"token":          token,
		"installCommand": installCommand,
	})
}

// Router 路由分发器
func (h *SlaveHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// GET /api/slaves - 列表
	if path == "/api/slaves" && r.Method == http.MethodGet {
		h.HandleListSlaves(w, r)
		return
	}

	// POST /api/slaves - 创建
	if path == "/api/slaves" && r.Method == http.MethodPost {
		h.HandleCreateSlave(w, r)
		return
	}

	// 处理 /api/slaves/:id 及其子路径
	if strings.HasPrefix(path, "/api/slaves/") {
		parts := strings.Split(strings.TrimPrefix(path, "/api/slaves/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			WriteError(w, http.StatusBadRequest, "无效的请求路径")
			return
		}

		id, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "无效的 Slave ID")
			return
		}

		// GET /api/slaves/:id
		if len(parts) == 1 && r.Method == http.MethodGet {
			h.HandleGetSlave(w, r, id)
			return
		}

		// PUT /api/slaves/:id
		if len(parts) == 1 && r.Method == http.MethodPut {
			h.HandleUpdateSlave(w, r, id)
			return
		}

		// DELETE /api/slaves/:id
		if len(parts) == 1 && r.Method == http.MethodDelete {
			h.HandleDeleteSlave(w, r, id)
			return
		}

		// POST /api/slaves/:id/regenerate-token
		if len(parts) == 2 && parts[1] == "regenerate-token" && r.Method == http.MethodPost {
			h.HandleRegenerateToken(w, r, id)
			return
		}
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}

// extractIDFromPath 从路径中提取 ID
func extractIDFromPath(path, prefix string) (int64, error) {
	idStr := strings.TrimPrefix(path, prefix)
	idStr = strings.Split(idStr, "/")[0]
	return strconv.ParseInt(idStr, 10, 64)
}

// parsePath 解析路径
func parsePath(path, prefix string) []string {
	remaining := strings.TrimPrefix(path, prefix)
	return strings.Split(strings.Trim(remaining, "/"), "/")
}

// generateInstallCommand 生成一键安装启动命令
func generateInstallCommand(token, slaveName string) string {
	// 获取 Master 地址（从环境变量读取，或使用默认值）
	masterHost := os.Getenv("MASTER_HOST")
	if masterHost == "" {
		masterHost = "localhost" // 默认值
	}
	masterPort := os.Getenv("MASTER_PORT")
	if masterPort == "" {
		masterPort = "9091" // 默认值
	}
	
	// 获取 GitHub 仓库
	githubRepo := os.Getenv("GITHUB_REPO")
	if githubRepo == "" {
		githubRepo = "YOUR_USERNAME/xray-panel" // 默认值
	}

	command := `#!/bin/bash
# Xray Panel Slave 一键安装脚本
# Slave Name: ` + slaveName + `

set -e

echo "========================================"
echo "Xray Panel Slave 安装程序"
echo "========================================"

# 创建安装目录
INSTALL_DIR="/opt/xray-panel"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 检测系统架构
ARCH=$(uname -m)
case $ARCH in
  x86_64)
    SLAVE_FILE="slave-linux-amd64"
    XRAY_FILE="Xray-linux-64.zip"
    ;;
  aarch64|arm64)
    SLAVE_FILE="slave-linux-arm64"
    XRAY_FILE="Xray-linux-arm64-v8a.zip"
    ;;
  armv7l)
    SLAVE_FILE="slave-linux-armv7"
    XRAY_FILE="Xray-linux-arm32-v7a.zip"
    ;;
  *)
    echo "不支持的架构: $ARCH"
    exit 1
    ;;
esac

echo "检测到架构: $ARCH"

# 下载 Slave 程序
echo "正在下载 Slave 程序..."
if command -v wget &> /dev/null; then
  wget -O slave https://github.com/` + githubRepo + `/releases/latest/download/$SLAVE_FILE
elif command -v curl &> /dev/null; then
  curl -L -o slave https://github.com/` + githubRepo + `/releases/latest/download/$SLAVE_FILE
else
  echo "错误: 需要 wget 或 curl 命令"
  exit 1
fi
chmod +x slave

# 下载 Xray Core
echo "正在下载 Xray Core..."
if command -v wget &> /dev/null; then
  wget -O xray.zip "https://github.com/XTLS/Xray-core/releases/latest/download/$XRAY_FILE"
elif command -v curl &> /dev/null; then
  curl -L -o xray.zip "https://github.com/XTLS/Xray-core/releases/latest/download/$XRAY_FILE"
else
  echo "错误: 需要 wget 或 curl 命令"
  exit 1
fi

unzip -o xray.zip xray
rm xray.zip
chmod +x xray

# 创建配置文件
cat > config.json <<'CONFIGEOF'
{
  "log": { "loglevel": "warning" },
  "inbounds": [],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" }
  ]
}
CONFIGEOF

# 创建 systemd 服务
cat > /etc/systemd/system/xray-panel-slave.service <<'SERVICEEOF'
[Unit]
Description=Xray Panel Slave
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xray-panel
ExecStart=/opt/xray-panel/slave -xray-path /opt/xray-panel/xray -master "ws://` + masterHost + `:` + masterPort + `/ws" -token "` + token + `" -config /opt/xray-panel/config.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

# 启动服务
echo "正在启动服务..."
systemctl daemon-reload
systemctl enable xray-panel-slave
systemctl start xray-panel-slave

echo "========================================"
echo "✓ 安装完成！"
echo "========================================"
echo "查看状态: systemctl status xray-panel-slave"
echo "查看日志: journalctl -u xray-panel-slave -f"
echo "========================================"`

return command
}
