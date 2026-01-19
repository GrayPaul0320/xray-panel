package xray

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// TrafficSnapshot 流量快照
type TrafficSnapshot struct {
	InboundTag string `json:"inbound_tag"`
	Uplink     int64  `json:"uplink"`
	Downlink   int64  `json:"downlink"`
	Timestamp  int64  `json:"timestamp"`
}

// TrafficCollector 流量收集器
type TrafficCollector struct {
	instance        *Instance
	lastSnapshot    map[string]*TrafficSnapshot
	aggregated      map[string]*TrafficSnapshot
	mu              sync.RWMutex
	collectTicker   *time.Ticker
	aggregateTicker *time.Ticker
	stopChan        chan struct{}
	onReport        func(map[string]*TrafficSnapshot)
}

// NewTrafficCollector 创建流量收集器
func NewTrafficCollector(instance *Instance) *TrafficCollector {
	return &TrafficCollector{
		instance:     instance,
		lastSnapshot: make(map[string]*TrafficSnapshot),
		aggregated:   make(map[string]*TrafficSnapshot),
		stopChan:     make(chan struct{}),
	}
}

// Start 启动流量收集
func (tc *TrafficCollector) Start(onReport func(map[string]*TrafficSnapshot)) {
	tc.onReport = onReport
	tc.collectTicker = time.NewTicker(10 * time.Second)
	tc.aggregateTicker = time.NewTicker(60 * time.Second)

	go tc.collectLoop()
	go tc.aggregateLoop()

	log.Println("✓ 流量收集器已启动 (收集间隔: 10s, 上报间隔: 60s)")
}

// collectLoop 收集循环
func (tc *TrafficCollector) collectLoop() {
	for {
		select {
		case <-tc.collectTicker.C:
			tc.collectTraffic()
		case <-tc.stopChan:
			return
		}
	}
}

// aggregateLoop 聚合循环
func (tc *TrafficCollector) aggregateLoop() {
	for {
		select {
		case <-tc.aggregateTicker.C:
			tc.reportAggregated()
		case <-tc.stopChan:
			return
		}
	}
}

// collectTraffic 收集流量数据
func (tc *TrafficCollector) collectTraffic() {
	if !tc.instance.IsRunning() {
		return
	}

	tc.mu.Lock()
	defer tc.mu.Unlock()

	// 遍历上次已知的或配置中的 inbound tags
	// 更好的做法是如果要准确获知 tag，需要从 config 中解析，或者 Xray stats manager 提供了遍历方法（目前版本可能没有直接列出所有 counter 的 API，需要构造 name）

	// 我们在这里尝试获取当前配置中的 inbound tags
	var inboundTags []string
	
	// 从暂存的配置中解析 inbound tags
	// 注意：这里是一个简单的反序列化过程，可能会有性能影响，但在 10s 一次的频率下是可以接受的
	// 如果 Instance 暴露了当前的 Inbounds 列表会更好
	var config Config
	if err := json.Unmarshal(tc.instance.config, &config); err == nil {
		for _, inbound := range config.Inbounds {
			inboundTags = append(inboundTags, inbound.Tag)
		}
	}

	now := time.Now().Unix()

	for _, tag := range inboundTags {
		// 使用 xray api 命令查询统计
		uplink := tc.queryStats(tag, "uplink")
		downlink := tc.queryStats(tag, "downlink")

		// 计算增量
		prevSnapshot, exists := tc.lastSnapshot[tag]
		var deltaUplink, deltaDownlink int64

		if exists {
			if uplink >= prevSnapshot.Uplink {
				deltaUplink = uplink - prevSnapshot.Uplink
			} else {
				// 计数器重置了
				deltaUplink = uplink
			}
			if downlink >= prevSnapshot.Downlink {
				deltaDownlink = downlink - prevSnapshot.Downlink
			} else {
				deltaDownlink = downlink
			}
		} else {
			deltaUplink = uplink
			deltaDownlink = downlink
		}

		if deltaUplink > 0 || deltaDownlink > 0 {
			log.Printf("[流量采样] %s: ↑%d ↓%d (Delta: ↑%d ↓%d)", tag, uplink, downlink, deltaUplink, deltaDownlink)
		}

		// 更新快照
		tc.lastSnapshot[tag] = &TrafficSnapshot{
			InboundTag: tag,
			Uplink:     uplink,
			Downlink:   downlink,
			Timestamp:  now,
		}

		// 累加到聚合数据
		if _, exists := tc.aggregated[tag]; !exists {
			tc.aggregated[tag] = &TrafficSnapshot{
				InboundTag: tag,
				Uplink:     0,
				Downlink:   0,
				Timestamp:  now,
			}
		}
		tc.aggregated[tag].Uplink += deltaUplink
		tc.aggregated[tag].Downlink += deltaDownlink
		tc.aggregated[tag].Timestamp = now
	}
}

// reportAggregated 上报聚合数据
func (tc *TrafficCollector) reportAggregated() {
	tc.mu.RLock()
	aggregated := make(map[string]*TrafficSnapshot)
	for tag, snapshot := range tc.aggregated {
		aggregated[tag] = &TrafficSnapshot{
			InboundTag: snapshot.InboundTag,
			Uplink:     snapshot.Uplink,
			Downlink:   snapshot.Downlink,
			Timestamp:  time.Now().Unix(),
		}
	}
	tc.mu.RUnlock()

	if len(aggregated) > 0 && tc.onReport != nil {
		tc.onReport(aggregated)
		
		// 清空聚合数据
		tc.mu.Lock()
		tc.aggregated = make(map[string]*TrafficSnapshot)
		tc.mu.Unlock()
	}
}

// Stop 停止流量收集
func (tc *TrafficCollector) Stop() {
	close(tc.stopChan)
	if tc.collectTicker != nil {
		tc.collectTicker.Stop()
	}
	if tc.aggregateTicker != nil {
		tc.aggregateTicker.Stop()
	}
	log.Println("✓ 流量收集器已停止")
}

// GetSnapshot 获取当前流量快照
func (tc *TrafficCollector) GetSnapshot() map[string]*TrafficSnapshot {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	
	snapshot := make(map[string]*TrafficSnapshot)
	for tag, s := range tc.lastSnapshot {
		snapshot[tag] = &TrafficSnapshot{
			InboundTag: s.InboundTag,
			Uplink:     s.Uplink,
			Downlink:   s.Downlink,
			Timestamp:  s.Timestamp,
		}
	}
	return snapshot
}

// ResetStats 重置统计数据
func (tc *TrafficCollector) ResetStats() {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	
	tc.lastSnapshot = make(map[string]*TrafficSnapshot)
	tc.aggregated = make(map[string]*TrafficSnapshot)
	
	log.Println("✓ 流量统计已重置")
}

// MarshalStats 将统计数据序列化为 JSON
func MarshalStats(stats map[string]*TrafficSnapshot) string {
	data, err := json.Marshal(stats)
	if err != nil {
		return "{}"
	}
	return string(data)
}

// queryStats 通过命令行 API 查询统计数据
func (tc *TrafficCollector) queryStats(tag string, direction string) int64 {
	apiPort := tc.instance.GetAPIPort()
	xrayPath := tc.instance.GetXrayPath()

	// 构造统计名称
	statName := fmt.Sprintf("inbound>>>%s>>>traffic>>>%s", tag, direction)

	// 调用 xray api statsquery 命令
	cmd := exec.Command(xrayPath, "api", "statsquery",
		"--server=127.0.0.1:"+strconv.Itoa(apiPort),
		"-pattern="+statName,
		"-reset=false")

	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		return 0
	}

	// 解析输出
	output := stdout.String()
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if strings.Contains(line, "value:") {
			parts := strings.Split(line, ":")
			if len(parts) == 2 {
				valueStr := strings.TrimSpace(parts[1])
				value, err := strconv.ParseInt(valueStr, 10, 64)
				if err == nil {
					return value
				}
			}
		}
	}

	return 0
}
