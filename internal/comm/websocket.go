package comm

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/graypaul/xray-panel/internal/model"
	"github.com/gorilla/websocket"
)

// MessageType 消息类型
type MessageType string

const (
	// MessageTypeAuth 认证消息
	MessageTypeAuth MessageType = "auth"
	// MessageTypeSyncRequest Slave 请求同步
	MessageTypeSyncRequest MessageType = "sync_request"
	// MessageTypeConfigDiff 配置增量消息
	MessageTypeConfigDiff MessageType = "config_diff"
	// MessageTypeAck 确认消息
	MessageTypeAck MessageType = "ack"
	// MessageTypeError 错误消息
	MessageTypeError MessageType = "error"
	// MessageTypePing 心跳消息
	MessageTypePing MessageType = "ping"
	// MessageTypePong 心跳响应
	MessageTypePong MessageType = "pong"
	// MessageTypeTrafficReport 流量上报
	MessageTypeTrafficReport MessageType = "traffic_report"
	// MessageTypeReportIP IP 地址上报
	MessageTypeReportIP MessageType = "report_ip"
)

// Message WebSocket 消息结构
type Message struct {
	Type      MessageType            `json:"type"`
	Timestamp int64                  `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// Client WebSocket 客户端连接
type Client struct {
	ID       string
	SlaveID  int64
	Conn     *websocket.Conn
	Send     chan *Message
	Hub      *Hub
	LastSeen time.Time // 最后收到消息的时间
	mu       sync.RWMutex
	isClosed bool
}

// Hub WebSocket 连接管理中心
type Hub struct {
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Message
	mu         sync.RWMutex
	DB         *model.DB
}

// NewHub 创建 WebSocket Hub
func NewHub(db *model.DB) *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *Message),
		DB:         db,
	}
}

// Run 启动 Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("客户端已注册: %s (Slave ID: %d)", client.ID, client.SlaveID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
				log.Printf("客户端已注销: %s (Slave ID: %d)", client.ID, client.SlaveID)

				// 更新 Slave 状态为离线
				if h.DB != nil {
					go func(slaveID int64) {
						if err := h.DB.UpdateSlaveStatus(slaveID, model.SlaveStatusOffline); err != nil {
							log.Printf("更新 Slave 状态失败: %v", err)
						} else {
							log.Printf("Slave [ID: %d] 状态已更新为 offline", slaveID)
						}
					}(client.SlaveID)
				}
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.ID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// GetClient 根据 ID 获取客户端
func (h *Hub) GetClient(id string) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	client, ok := h.clients[id]
	return client, ok
}

// GetClientBySlaveID 根据 Slave ID 获取客户端
func (h *Hub) GetClientBySlaveID(slaveID int64) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, client := range h.clients {
		if client.SlaveID == slaveID {
			return client, true
		}
	}
	return nil, false
}

// GetAllClients 获取所有客户端
func (h *Hub) GetAllClients() []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients := make([]*Client, 0, len(h.clients))
	for _, client := range h.clients {
		clients = append(clients, client)
	}
	return clients
}

// SendToClient 发送消息给指定客户端
func (h *Hub) SendToClient(clientID string, message *Message) error {
	client, ok := h.GetClient(clientID)
	if !ok {
		return fmt.Errorf("客户端不存在: %s", clientID)
	}

	select {
	case client.Send <- message:
		return nil
	default:
		return fmt.Errorf("客户端消息队列已满")
	}
}

// Register 注册客户端
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister 注销客户端
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// Broadcast 广播消息
func (h *Hub) Broadcast(message *Message) {
	h.broadcast <- message
}

// NewClient 创建新的 WebSocket 客户端
func NewClient(id string, slaveID int64, conn *websocket.Conn, hub *Hub) *Client {
	return &Client{
		ID:       id,
		SlaveID:  slaveID,
		Conn:     conn,
		Send:     make(chan *Message, 256),
		Hub:      hub,
		LastSeen: time.Now(), // 初始化 LastSeen
	}
}

// ReadPump 读取来自客户端的消息
func (c *Client) ReadPump(handler func(*Client, *Message)) {
	defer func() {
		c.Hub.Unregister(c)
		c.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.updateLastSeen() // 更新 LastSeen
		return nil
	})

	for {
		_, messageData, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket 读取错误: %v", err)
			}
			break
		}

		// 更新 LastSeen 时间
		c.updateLastSeen()

		var message Message
		if err := json.Unmarshal(messageData, &message); err != nil {
			log.Printf("消息解析失败: %v", err)
			continue
		}

		// 调用处理函数
		if handler != nil {
			handler(c, &message)
		}
	}
}

// WritePump 发送消息到客户端
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				log.Printf("消息序列化失败: %v", err)
				continue
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendMessage 发送消息
func (c *Client) SendMessage(msgType MessageType, data map[string]interface{}) error {
	c.mu.RLock()
	if c.isClosed {
		c.mu.RUnlock()
		return fmt.Errorf("连接已关闭")
	}
	c.mu.RUnlock()

	message := &Message{
		Type:      msgType,
		Timestamp: time.Now().Unix(),
		Data:      data,
	}

	select {
	case c.Send <- message:
		return nil
	default:
		return fmt.Errorf("消息队列已满")
	}
}

// updateLastSeen 更新最后见到的时间
func (c *Client) updateLastSeen() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.LastSeen = time.Now()
}

// GetLastSeen 获取最后见到的时间
func (c *Client) GetLastSeen() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.LastSeen
}

// Close 关闭连接
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isClosed {
		c.isClosed = true
		c.Conn.Close()
	}
}

// WebSocket 升级器
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// 生产环境应该进行严格的来源检查
		return true
	},
}

// UpgradeConnection 升级 HTTP 连接为 WebSocket
func UpgradeConnection(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, err
	}
	return conn, nil
}
