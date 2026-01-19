package model

import (
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

// SlaveStatus 表示 Slave 节点的状态
type SlaveStatus string

const (
	SlaveStatusOnline  SlaveStatus = "online"
	SlaveStatusOffline SlaveStatus = "offline"
	SlaveStatusError   SlaveStatus = "error"
)

// Slave 表示 Slave 节点
type Slave struct {
	ID             int64       `json:"id"`
	Name           string      `json:"name"`
	IP             string      `json:"ip"`
	CurrentVersion int64       `json:"current_version"`
	Status         SlaveStatus `json:"status"`
	XrayStatus     string      `json:"xray_status"`
	LastSeen       *time.Time  `json:"last_seen,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// ConfigAction 表示配置操作类型
type ConfigAction string

const (
	ConfigActionAdd    ConfigAction = "ADD"
	ConfigActionDelete ConfigAction = "DEL"
	ConfigActionUpdate ConfigAction = "UPDATE"
)

// ConfigDiff 表示配置的增量变更
type ConfigDiff struct {
	ID        int64        `json:"id"`
	SlaveID   int64        `json:"slave_id"`
	Version   int64        `json:"version"`
	Type      string       `json:"type"` // inbound, outbound, routing, balancer
	Action    ConfigAction `json:"action"`
	Content   string       `json:"content"` // JSON 字符串
	CreatedAt time.Time    `json:"created_at"`
}

// TrafficStats 表示流量统计记录
type TrafficStats struct {
	SlaveID      int64     `json:"slave_id"`
	InboundTag   string    `json:"inbound_tag"`
	TotalUplink   int64     `json:"total_uplink"`
	TotalDownlink int64     `json:"total_downlink"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// DB 包装数据库连接
type DB struct {
	*sql.DB
}

// NewDB 创建数据库连接
func NewDB(dataSourceName string) (*DB, error) {
	db, err := sql.Open("postgres", dataSourceName)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

// InitSchema 初始化数据库表结构
func (db *DB) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS slaves (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL UNIQUE,
		current_version BIGINT NOT NULL DEFAULT 0,
		status VARCHAR(50) NOT NULL DEFAULT 'offline',
		xray_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
		last_seen TIMESTAMP,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	-- 自动迁移: 添加 xray_status 字段 (如果表已存在但字段缺失)
	ALTER TABLE slaves ADD COLUMN IF NOT EXISTS xray_status VARCHAR(50) NOT NULL DEFAULT 'unknown';

	CREATE INDEX IF NOT EXISTS idx_slaves_status ON slaves(status);
	CREATE INDEX IF NOT EXISTS idx_slaves_name ON slaves(name);

	CREATE TABLE IF NOT EXISTS config_diffs (
		id SERIAL PRIMARY KEY,
		slave_id INTEGER NOT NULL REFERENCES slaves(id) ON DELETE CASCADE,
		version BIGINT NOT NULL,
		type VARCHAR(50) NOT NULL DEFAULT 'inbound',
		action VARCHAR(50) NOT NULL,
		content TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_config_diffs_slave_version ON config_diffs(slave_id, version);
	CREATE INDEX IF NOT EXISTS idx_config_diffs_type ON config_diffs(slave_id, type);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_config_diffs_unique ON config_diffs(slave_id, version);

	CREATE TABLE IF NOT EXISTS traffic_stats (
		slave_id INTEGER NOT NULL REFERENCES slaves(id) ON DELETE CASCADE,
		inbound_tag VARCHAR(255) NOT NULL,
		total_uplink BIGINT NOT NULL DEFAULT 0,
		total_downlink BIGINT NOT NULL DEFAULT 0,
		updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (slave_id, inbound_tag)
	);

	CREATE INDEX IF NOT EXISTS idx_traffic_stats_slave ON traffic_stats(slave_id);
	CREATE INDEX IF NOT EXISTS idx_traffic_stats_updated ON traffic_stats(updated_at);
	`

	_, err := db.Exec(schema)
	return err
}

// CreateSlave 创建新的 Slave 节点
func (db *DB) CreateSlave(name string) (*Slave, error) {
	slave := &Slave{
		Name:           name,
		CurrentVersion: 0,
		Status:         SlaveStatusOffline,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	err := db.QueryRow(`
		INSERT INTO slaves (name, current_version, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, slave.Name, slave.CurrentVersion, slave.Status, slave.CreatedAt, slave.UpdatedAt).Scan(&slave.ID)

	if err != nil {
		return nil, err
	}

	return slave, nil
}

// GetSlaveByID 根据 ID 获取 Slave
func (db *DB) GetSlaveByID(id int64) (*Slave, error) {
	slave := &Slave{}
	err := db.QueryRow(`
		SELECT id, name, current_version, status, xray_status, last_seen, created_at, updated_at
		FROM slaves WHERE id = $1
	`, id).Scan(&slave.ID, &slave.Name, &slave.CurrentVersion, &slave.Status,
		&slave.XrayStatus, &slave.LastSeen, &slave.CreatedAt, &slave.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return slave, nil
}

// GetSlaveByName 根据名称获取 Slave
func (db *DB) GetSlaveByName(name string) (*Slave, error) {
	slave := &Slave{}
	err := db.QueryRow(`
		SELECT id, name, current_version, status, xray_status, last_seen, created_at, updated_at
		FROM slaves WHERE name = $1
	`, name).Scan(&slave.ID, &slave.Name, &slave.CurrentVersion, &slave.Status,
		&slave.XrayStatus, &slave.LastSeen, &slave.CreatedAt, &slave.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return slave, nil
}

// UpdateSlaveVersion 更新 Slave 的版本号
func (db *DB) UpdateSlaveVersion(id int64, version int64) error {
	_, err := db.Exec(`
		UPDATE slaves SET current_version = $1, updated_at = $2 WHERE id = $3
	`, version, time.Now(), id)
	return err
}

// UpdateSlaveStatus 更新 Slave 的状态
func (db *DB) UpdateSlaveStatus(id int64, status SlaveStatus) error {
	_, err := db.Exec(`
		UPDATE slaves SET status = $1, last_seen = $2, updated_at = $3 WHERE id = $4
	`, status, time.Now(), time.Now(), id)
	return err
}

// UpdateSlaveXrayStatus 更新 Slave 的 Xray 状态
func (db *DB) UpdateSlaveXrayStatus(id int64, xrayStatus string) error {
	_, err := db.Exec(`
		UPDATE slaves SET xray_status = $1, updated_at = $2 WHERE id = $3
	`, xrayStatus, time.Now(), id)
	return err
}

// UpdateSlaveIP 更新 Slave 的 IP 地址
func (db *DB) UpdateSlaveIP(id int64, ip string) error {
	_, err := db.Exec(`
		UPDATE slaves SET ip = $1, updated_at = $2 WHERE id = $3
	`, ip, time.Now(), id)
	return err
}

// ListSlaves 列出所有 Slave 节点
func (db *DB) ListSlaves() ([]*Slave, error) {
	rows, err := db.Query(`
		SELECT id, name, current_version, status, xray_status, last_seen, created_at, updated_at
		FROM slaves ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slaves []*Slave
	for rows.Next() {
		slave := &Slave{}
		if err := rows.Scan(&slave.ID, &slave.Name, &slave.CurrentVersion, &slave.Status,
			&slave.XrayStatus, &slave.LastSeen, &slave.CreatedAt, &slave.UpdatedAt); err != nil {
			return nil, err
		}
		slaves = append(slaves, slave)
	}

	return slaves, rows.Err()
}

// CreateConfigDiff 创建配置增量记录
func (db *DB) CreateConfigDiff(slaveID, version int64, configType string, action ConfigAction, content string) error {
	_, err := db.Exec(`
		INSERT INTO config_diffs (slave_id, version, type, action, content, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, slaveID, version, configType, action, content, time.Now())
	return err
}

// GetConfigDiffs 获取指定 Slave 从指定版本开始的所有增量配置
func (db *DB) GetConfigDiffs(slaveID, fromVersion int64) ([]*ConfigDiff, error) {
	rows, err := db.Query(`
		SELECT id, slave_id, version, type, action, content, created_at
		FROM config_diffs
		WHERE slave_id = $1 AND version > $2
		ORDER BY version ASC
	`, slaveID, fromVersion)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var diffs []*ConfigDiff
	for rows.Next() {
		diff := &ConfigDiff{}
		if err := rows.Scan(&diff.ID, &diff.SlaveID, &diff.Version, &diff.Type, &diff.Action,
			&diff.Content, &diff.CreatedAt); err != nil {
			return nil, err
		}
		diffs = append(diffs, diff)
	}

	return diffs, rows.Err()
}

// GetLatestVersion 获取指定 Slave 的最新配置版本号
func (db *DB) GetLatestVersion(slaveID int64) (int64, error) {
	var version int64
	err := db.QueryRow(`
		SELECT COALESCE(MAX(version), 0) FROM config_diffs WHERE slave_id = $1
	`, slaveID).Scan(&version)
	return version, err
}

// GetConfigDiffByID 根据 ID 获取单个配置差异
func (db *DB) GetConfigDiffByID(id int64) (*ConfigDiff, error) {
	diff := &ConfigDiff{}
	err := db.QueryRow(`
		SELECT id, slave_id, version, type, action, content, created_at
		FROM config_diffs WHERE id = $1
	`, id).Scan(&diff.ID, &diff.SlaveID, &diff.Version, &diff.Type, &diff.Action,
		&diff.Content, &diff.CreatedAt)

	if err != nil {
		return nil, err
	}

	return diff, nil
}

// GetConfigDiffsByType 获取指定类型的配置差异
func (db *DB) GetConfigDiffsByType(slaveID int64, configType string, fromVersion int64) ([]*ConfigDiff, error) {
	rows, err := db.Query(`
		SELECT id, slave_id, version, type, action, content, created_at
		FROM config_diffs
		WHERE slave_id = $1 AND type = $2 AND version > $3
		ORDER BY version ASC
	`, slaveID, configType, fromVersion)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var diffs []*ConfigDiff
	for rows.Next() {
		diff := &ConfigDiff{}
		if err := rows.Scan(&diff.ID, &diff.SlaveID, &diff.Version, &diff.Type, &diff.Action,
			&diff.Content, &diff.CreatedAt); err != nil {
			return nil, err
		}
		diffs = append(diffs, diff)
	}

	return diffs, rows.Err()
}

// UpdateTrafficStats 原子更新流量统计（累加 delta）
func (db *DB) UpdateTrafficStats(slaveID int64, inboundTag string, deltaUplink, deltaDownlink int64) error {
	_, err := db.Exec(`
		INSERT INTO traffic_stats (slave_id, inbound_tag, total_uplink, total_downlink, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (slave_id, inbound_tag) 
		DO UPDATE SET
			total_uplink = traffic_stats.total_uplink + EXCLUDED.total_uplink,
			total_downlink = traffic_stats.total_downlink + EXCLUDED.total_downlink,
			updated_at = EXCLUDED.updated_at
	`, slaveID, inboundTag, deltaUplink, deltaDownlink, time.Now())
	return err
}

// GetTrafficStats 获取指定 Slave 的流量统计
func (db *DB) GetTrafficStats(slaveID int64) ([]*TrafficStats, error) {
	rows, err := db.Query(`
		SELECT slave_id, inbound_tag, total_uplink, total_downlink, updated_at
		FROM traffic_stats
		WHERE slave_id = $1
		ORDER BY inbound_tag
	`, slaveID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*TrafficStats
	for rows.Next() {
		stat := &TrafficStats{}
		if err := rows.Scan(&stat.SlaveID, &stat.InboundTag, &stat.TotalUplink,
			&stat.TotalDownlink, &stat.UpdatedAt); err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	return stats, rows.Err()
}

// GetAllTrafficStats 获取所有 Slave 的流量统计
func (db *DB) GetAllTrafficStats() ([]*TrafficStats, error) {
	rows, err := db.Query(`
		SELECT slave_id, inbound_tag, total_uplink, total_downlink, updated_at
		FROM traffic_stats
		ORDER BY slave_id, inbound_tag
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*TrafficStats
	for rows.Next() {
		stat := &TrafficStats{}
		if err := rows.Scan(&stat.SlaveID, &stat.InboundTag, &stat.TotalUplink,
			&stat.TotalDownlink, &stat.UpdatedAt); err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	return stats, rows.Err()
}

// ResetAllSlaveStatuses 重置所有 Slave 状态为 offline (用于系统启动时)
func (db *DB) ResetAllSlaveStatuses() error {
_, err := db.Exec(`UPDATE slaves SET status = $1, xray_status = 'unknown', updated_at = $2`, SlaveStatusOffline, time.Now())
return err
}
