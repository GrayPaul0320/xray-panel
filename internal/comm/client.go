package comm

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// SlaveClient Slave 端 WebSocket 客户端
type SlaveClient struct {
	serverURL    string
	token        string
	conn         *websocket.Conn
	send         chan *Message
	mu           sync.RWMutex
	isConnected  bool
	reconnecting bool
	handlers     map[MessageType]MessageHandler
}

// MessageHandler 消息处理函数
type MessageHandler func(*Message) error

// NewSlaveClient 创建 Slave 客户端
func NewSlaveClient(serverURL, token string) *SlaveClient {
	return &SlaveClient{
		serverURL:   serverURL,
		token:       token,
		send:        make(chan *Message, 256),
		handlers:    make(map[MessageType]MessageHandler),
		isConnected: false,
	}
}

// RegisterHandler 注册消息处理器
func (sc *SlaveClient) RegisterHandler(msgType MessageType, handler MessageHandler) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	sc.handlers[msgType] = handler
}

// Connect 连接到 Master
func (sc *SlaveClient) Connect() error {
	sc.mu.Lock()
	if sc.isConnected {
		sc.mu.Unlock()
		return fmt.Errorf("已经连接")
	}
	sc.mu.Unlock()

	// 解析 URL 并添加 token
	u, err := url.Parse(sc.serverURL)
	if err != nil {
		return fmt.Errorf("解析 URL 失败: %w", err)
	}

	q := u.Query()
	q.Set("token", sc.token)
	u.RawQuery = q.Encode()

	log.Printf("连接到 Master: %s", u.String())

	// 建立 WebSocket 连接
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return fmt.Errorf("WebSocket 连接失败: %w", err)
	}

	sc.mu.Lock()
	sc.conn = conn
	sc.isConnected = true
	sc.mu.Unlock()

	log.Println("✓ 已连接到 Master")

	// 启动读写协程
	go sc.readPump()
	go sc.writePump()

	return nil
}

// Disconnect 断开连接
func (sc *SlaveClient) Disconnect() error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if !sc.isConnected || sc.conn == nil {
		return fmt.Errorf("未连接")
	}

	sc.isConnected = false
	close(sc.send)
	return sc.conn.Close()
}

// SendMessage 发送消息
func (sc *SlaveClient) SendMessage(msgType MessageType, data map[string]interface{}) error {
	sc.mu.RLock()
	if !sc.isConnected {
		sc.mu.RUnlock()
		return fmt.Errorf("未连接到服务器")
	}
	sc.mu.RUnlock()

	message := &Message{
		Type:      msgType,
		Timestamp: time.Now().Unix(),
		Data:      data,
	}

	select {
	case sc.send <- message:
		return nil
	case <-time.After(5 * time.Second):
		return fmt.Errorf("发送消息超时")
	}
}

// RequestSync 请求配置同步
func (sc *SlaveClient) RequestSync(localVersion int64) error {
	log.Printf("请求配置同步，本地版本: %d", localVersion)
	return sc.SendMessage(MessageTypeSyncRequest, map[string]interface{}{
		"local_version": localVersion,
	})
}

// SendAck 发送确认消息
func (sc *SlaveClient) SendAck(version int64, status, message string) error {
	return sc.SendMessage(MessageTypeAck, map[string]interface{}{
		"version": version,
		"status":  status,
		"message": message,
	})
}

// SendPing 发送心跳
func (sc *SlaveClient) SendPing() error {
	return sc.SendMessage(MessageTypePing, map[string]interface{}{})
}

// readPump 读取消息
func (sc *SlaveClient) readPump() {
	defer func() {
		sc.mu.Lock()
		sc.isConnected = false
		sc.mu.Unlock()
		sc.conn.Close()
		log.Println("连接已断开，尝试重连...")
		sc.reconnect()
	}()

	sc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	sc.conn.SetPongHandler(func(string) error {
		sc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, messageData, err := sc.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket 读取错误: %v", err)
			}
			break
		}

		var message Message
		if err := json.Unmarshal(messageData, &message); err != nil {
			log.Printf("消息解析失败: %v", err)
			continue
		}

		// 调用消息处理器
		sc.handleMessage(&message)
	}
}

// writePump 发送消息
func (sc *SlaveClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		sc.conn.Close()
	}()

	for {
		select {
		case message, ok := <-sc.send:
			sc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				sc.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				log.Printf("消息序列化失败: %v", err)
				continue
			}

			if err := sc.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}

		case <-ticker.C:
			sc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := sc.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理接收到的消息
func (sc *SlaveClient) handleMessage(msg *Message) {
	log.Printf("收到消息 [类型: %s]", msg.Type)

	sc.mu.RLock()
	handler, ok := sc.handlers[msg.Type]
	sc.mu.RUnlock()

	if ok {
		if err := handler(msg); err != nil {
			log.Printf("消息处理失败: %v", err)
		}
	} else {
		log.Printf("未注册的消息类型: %s", msg.Type)
	}
}

// reconnect 重新连接
func (sc *SlaveClient) reconnect() {
	sc.mu.Lock()
	if sc.reconnecting {
		sc.mu.Unlock()
		return
	}
	sc.reconnecting = true
	sc.mu.Unlock()

	defer func() {
		sc.mu.Lock()
		sc.reconnecting = false
		sc.mu.Unlock()
	}()

	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		log.Printf("尝试重新连接... (等待 %v)", backoff)
		time.Sleep(backoff)

		if err := sc.Connect(); err != nil {
			log.Printf("重连失败: %v", err)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		log.Println("✓ 重连成功")
		break
	}
}

// IsConnected 检查是否已连接
func (sc *SlaveClient) IsConnected() bool {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.isConnected
}
