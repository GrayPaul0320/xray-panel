package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/graypaul/xray-panel/internal/comm"
	"github.com/graypaul/xray-panel/internal/handler"
	"github.com/graypaul/xray-panel/internal/model"
	"github.com/google/uuid"
)

func main() {
	// 命令行参数
	dbDSN := flag.String("db", "postgres://xray_admin:xray123456@localhost/xray_panel?sslmode=disable", "PostgreSQL 连接字符串")
	jwtSecret := flag.String("jwt-secret", "change-me-in-production", "JWT 密钥")
	listenAddr := flag.String("listen", ":8080", "WebSocket 监听地址")
	flag.Parse()

	log.Println("========================================")
	log.Println("Xray Panel - Master 节点")
	log.Println("========================================")

	// 连接数据库
	log.Println("连接数据库...")
	db, err := model.NewDB(*dbDSN)
	if err != nil {
		log.Fatalf("✗ 连接数据库失败: %v", err)
	}
	defer db.Close()
	log.Println("✓ 数据库连接成功")

	// 初始化数据库表结构
	log.Println("初始化数据库表结构...")
	if err := db.InitSchema(); err != nil {
		log.Fatalf("✗ 初始化数据库失败: %v", err)
	}
	log.Println("✓ 数据库表结构初始化完成")

	// 重置所有 Slave 状态
	if err := db.ResetAllSlaveStatuses(); err != nil {
		log.Printf("⚠️ 重置 Slave 状态失败: %v", err)
	} else {
		log.Println("✓ 已重置所有 Slave 状态为 offline")
	}

	// 创建 JWT 认证管理器
	jwtAuth := comm.NewJWTAuth(*jwtSecret, "xray-panel-master", 24*time.Hour)
	log.Println("✓ JWT 认证管理器已创建")

	// 创建 WebSocket Hub
	hub := comm.NewHub(db)
	go hub.Run()
	log.Println("✓ WebSocket Hub 已启动")

	// 创建同步管理器
	syncManager := comm.NewSyncManager(db, hub, jwtAuth)
	log.Println("✓ 同步管理器已创建")

	// 启动心跳超时监控
	go startHeartbeatMonitor(hub, db, 90*time.Second)
	log.Println("✓ 心跳监控已启动")

	// 创建 API Handlers
	slaveHandler := handler.NewSlaveHandler(db, jwtAuth, hub)
	inboundHandler := handler.NewInboundHandler(db, syncManager, hub)
	outboundHandler := handler.NewOutboundHandler(db, syncManager, hub)
	routingHandler := handler.NewRoutingHandler(db, syncManager, hub)
	balancerHandler := handler.NewBalancerHandler(db, syncManager, hub)
	statsHandler := handler.NewStatsHandler(db)
	systemHandler := handler.NewSystemHandler(db)
	log.Println("✓ API Handlers 已创建")

	// 设置 HTTP 路由
	// WebSocket 端点
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(w, r, hub, syncManager, jwtAuth, db)
	})

	// 健康检查
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// 生成 Token
	http.HandleFunc("/api/token", func(w http.ResponseWriter, r *http.Request) {
		handleGenerateToken(w, r, jwtAuth, db)
	})

	// Slave 管理 API
	http.HandleFunc("/api/slaves", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			return
		}
		slaveHandler.Router(w, r)
	})
	http.HandleFunc("/api/slaves/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			return
		}
		// 检查是否是 Inbound 相关路由
		if strings.Contains(r.URL.Path, "/inbounds") {
			inboundHandler.Router(w, r)
			return
		}
		// 检查是否是 Outbound 相关路由
		if strings.Contains(r.URL.Path, "/outbounds") {
			outboundHandler.Router(w, r)
			return
		}
		// 检查是否是 Routing 相关路由
		if strings.Contains(r.URL.Path, "/routing") {
			routingHandler.Router(w, r)
			return
		}
		// 检查是否是 Balancer 相关路由
		if strings.Contains(r.URL.Path, "/balancers") {
			balancerHandler.Router(w, r)
			return
		}
		slaveHandler.Router(w, r)
	})

	// Inbound 管理 API
	// 注意：这些路由会被 /api/slaves/ 捕获，所以不需要单独注册

	// 流量统计 API
	http.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			return
		}
		statsHandler.Router(w, r)
	})
	http.HandleFunc("/api/traffic/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			return
		}
		statsHandler.Router(w, r)
	})

	// 系统管理 API
	http.HandleFunc("/api/system/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			return
		}
		systemHandler.Router(w, r)
	})

	// Inbound 相关路由需要特殊处理（因为路径包含在 /api/slaves/ 中）
	// 添加一个统一的路由处理器
	http.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method == "OPTIONS" {
			return
		}

		path := r.URL.Path
		// 处理 Inbound 相关路由
		if len(path) > 12 && path[:12] == "/api/slaves/" {
			// 检查是否是 Inbound 相关路由
			if strings.Contains(path, "/inbounds") {
				inboundHandler.Router(w, r)
				return
			}
			// 检查是否是 Outbound 相关路由
			if strings.Contains(path, "/outbounds") {
				outboundHandler.Router(w, r)
				return
			}
			// 检查是否是 Routing 相关路由
			if strings.Contains(path, "/routing") {
				routingHandler.Router(w, r)
				return
			}
			// 检查是否是 Balancer 相关路由
			if strings.Contains(path, "/balancers") {
				balancerHandler.Router(w, r)
				return
			}
			// 其他 Slave 相关路由
			slaveHandler.Router(w, r)
			return
		}

		// 未匹配的路由
		http.NotFound(w, r)
	})

	log.Println("✓ HTTP 路由已注册")

	log.Println("========================================")
	log.Printf("✓ Master 节点启动成功，监听地址: %s", *listenAddr)
	log.Println("WebSocket 端点: /ws")
	log.Println("健康检查: /health")
	log.Println("生成 Token: /api/token")
	log.Println("========================================")

	// 启动 HTTP 服务器
	server := &http.Server{
		Addr:         *listenAddr,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("✗ HTTP 服务器错误: %v", err)
		}
	}()

	// 等待中断信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	fmt.Println("Master 节点正在运行... (按 Ctrl+C 停止)")
	<-sigChan

	log.Println("\n正在关闭 Master 节点...")
	log.Println("Master 节点已关闭")
}

// enableCORS 启用 CORS
func enableCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

// handleWebSocket 处理 WebSocket 连接
func handleWebSocket(w http.ResponseWriter, r *http.Request, hub *comm.Hub,
	syncManager *comm.SyncManager, jwtAuth *comm.JWTAuth, db *model.DB) {

	// 从查询参数或 Header 中获取 Token
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("Authorization")
	}

	if token == "" {
		http.Error(w, "缺少 Token", http.StatusUnauthorized)
		return
	}

	// 验证 JWT Token
	claims, err := jwtAuth.ValidateToken(token)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token 验证失败: %v", err), http.StatusUnauthorized)
		return
	}

	log.Printf("Slave [%s, ID: %d] 尝试连接", claims.SlaveName, claims.SlaveID)

	// 升级为 WebSocket 连接
	conn, err := comm.UpgradeConnection(w, r)
	if err != nil {
		log.Printf("WebSocket 升级失败: %v", err)
		return
	}

	// 更新 Slave 状态为在线
	if err := db.UpdateSlaveStatus(claims.SlaveID, model.SlaveStatusOnline); err != nil {
		log.Printf("更新 Slave 状态失败: %v", err)
	}

	// 创建客户端
	clientID := uuid.New().String()
	client := comm.NewClient(clientID, claims.SlaveID, conn, hub)

	// 注册客户端
	hub.Register(client)

	// 发送认证成功消息
	client.SendMessage(comm.MessageTypeAuth, map[string]interface{}{
		"status":  "success",
		"message": "认证成功",
	})

	log.Printf("✓ Slave [%s, ID: %d] 已连接，客户端 ID: %s", claims.SlaveName, claims.SlaveID, clientID)

	// 启动读写协程
	go client.WritePump()
	go client.ReadPump(syncManager.HandleMessage)
}

// handleGenerateToken 生成 JWT Token（用于测试和管理）
func handleGenerateToken(w http.ResponseWriter, r *http.Request, jwtAuth *comm.JWTAuth, db *model.DB) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 从请求中获取 Slave 名称
	slaveName := r.URL.Query().Get("name")
	if slaveName == "" {
		http.Error(w, "缺少 name 参数", http.StatusBadRequest)
		return
	}

	// 查找或创建 Slave
	slave, err := db.GetSlaveByName(slaveName)
	if err != nil {
		// Slave 不存在，创建新的
		slave, err = db.CreateSlave(slaveName)
		if err != nil {
			http.Error(w, fmt.Sprintf("创建 Slave 失败: %v", err), http.StatusInternalServerError)
			return
		}
		log.Printf("创建新 Slave: %s (ID: %d)", slaveName, slave.ID)
	}

	// 生成 Token
	token, err := jwtAuth.GenerateToken(slave.ID, slave.Name)
	if err != nil {
		http.Error(w, fmt.Sprintf("生成 Token 失败: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"token":"%s","slave_id":%d,"slave_name":"%s"}`, token, slave.ID, slave.Name)
	log.Printf("为 Slave [%s, ID: %d] 生成 Token", slaveName, slave.ID)
}
// startHeartbeatMonitor 启动心跳超时监控
func startHeartbeatMonitor(hub *comm.Hub, db *model.DB, timeout time.Duration) {
	ticker := time.NewTicker(30 * time.Second) // 每30秒检查一次
	defer ticker.Stop()

	log.Println("心跳监控已启动，超时阈值:", timeout)

	for range ticker.C {
		now := time.Now()
		clients := hub.GetAllClients()

		for _, client := range clients {
			lastSeen := client.GetLastSeen()
			if !lastSeen.IsZero() && now.Sub(lastSeen) > timeout {
				log.Printf("⚠️  Slave [ID: %d] 心跳超时 (最后见到: %v)", client.SlaveID, lastSeen)
				
				// 更新数据库状态为离线
				if err := db.UpdateSlaveStatus(client.SlaveID, model.SlaveStatusOffline); err != nil {
					log.Printf("更新 Slave 状态失败: %v", err)
				}
				
				// 断开连接
				hub.Unregister(client)
			}
		}
	}
}