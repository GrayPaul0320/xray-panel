package xray

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// VersionStore 版本存储
type VersionStore struct {
	filePath string
	mu       sync.RWMutex
	version  int64
}

// VersionData 版本数据结构
type VersionData struct {
	Version int64 `json:"version"`
}

// NewVersionStore 创建版本存储
func NewVersionStore(filePath string) (*VersionStore, error) {
	// 确保目录存在
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建目录失败: %w", err)
	}

	vs := &VersionStore{
		filePath: filePath,
		version:  0,
	}

	// 加载现有版本
	if err := vs.Load(); err != nil {
		// 如果文件不存在，创建初始版本
		if os.IsNotExist(err) {
			vs.version = 0
			if err := vs.Save(); err != nil {
				return nil, fmt.Errorf("初始化版本文件失败: %w", err)
			}
		} else {
			return nil, fmt.Errorf("加载版本失败: %w", err)
		}
	}

	return vs, nil
}

// Load 从文件加载版本
func (vs *VersionStore) Load() error {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	data, err := os.ReadFile(vs.filePath)
	if err != nil {
		return err
	}

	var versionData VersionData
	if err := json.Unmarshal(data, &versionData); err != nil {
		return fmt.Errorf("解析版本数据失败: %w", err)
	}

	vs.version = versionData.Version
	return nil
}

// Save 保存版本到文件
func (vs *VersionStore) Save() error {
	vs.mu.RLock()
	versionData := VersionData{Version: vs.version}
	vs.mu.RUnlock()

	data, err := json.MarshalIndent(versionData, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化版本数据失败: %w", err)
	}

	// 写入临时文件，然后原子性地重命名
	tempFile := vs.filePath + ".tmp"
	if err := os.WriteFile(tempFile, data, 0644); err != nil {
		return fmt.Errorf("写入临时文件失败: %w", err)
	}

	if err := os.Rename(tempFile, vs.filePath); err != nil {
		os.Remove(tempFile)
		return fmt.Errorf("重命名文件失败: %w", err)
	}

	return nil
}

// GetVersion 获取当前版本
func (vs *VersionStore) GetVersion() int64 {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return vs.version
}

// SetVersion 设置版本并保存
func (vs *VersionStore) SetVersion(version int64) error {
	vs.mu.Lock()
	vs.version = version
	vs.mu.Unlock()

	return vs.Save()
}

// IncrementVersion 递增版本并保存
func (vs *VersionStore) IncrementVersion() (int64, error) {
	vs.mu.Lock()
	vs.version++
	newVersion := vs.version
	vs.mu.Unlock()

	if err := vs.Save(); err != nil {
		return 0, err
	}

	return newVersion, nil
}

// UpdateVersion 更新到指定版本（如果新版本更大）
func (vs *VersionStore) UpdateVersion(newVersion int64) error {
	vs.mu.Lock()
	if newVersion > vs.version {
		vs.version = newVersion
		vs.mu.Unlock()
		return vs.Save()
	}
	vs.mu.Unlock()
	return nil
}
