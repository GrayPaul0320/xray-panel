package handler

import (
	"log"
	"net/http"
	"time"

	"github.com/graypaul/xray-panel/internal/model"
)

// StatsHandler 处理流量统计相关的 HTTP 请求
type StatsHandler struct {
	db *model.DB
}

// NewStatsHandler 创建统计处理器
func NewStatsHandler(db *model.DB) *StatsHandler {
	return &StatsHandler{db: db}
}

// SystemStatsResponse 系统统计响应
type SystemStatsResponse struct {
	TotalSlaves      int   `json:"totalSlaves"`
	OnlineSlaves     int   `json:"onlineSlaves"`
	OfflineSlaves    int   `json:"offlineSlaves"`
	ActiveConnections int   `json:"activeConnections"`
	TotalTraffic     TrafficSummary `json:"totalTraffic"`
	TodayTraffic     TrafficSummary `json:"todayTraffic"`
	MonthTraffic     TrafficSummary `json:"monthTraffic"`
}

// TrafficSummary 流量汇总
type TrafficSummary struct {
	Uplink   int64 `json:"uplink"`
	Downlink int64 `json:"downlink"`
}

// TrafficStatsResponse 流量统计响应
type TrafficStatsResponse struct {
	TodayTraffic   TrafficSummary      `json:"todayTraffic"`
	MonthTraffic   TrafficSummary      `json:"monthTraffic"`
	RealtimeData   []RealtimeDataPoint `json:"realtimeData"`
	SlaveRanking   []RankingItem       `json:"slaveRanking"`
	NodeRanking    []RankingItem       `json:"nodeRanking"`
}

// RealtimeDataPoint 实时数据点
type RealtimeDataPoint struct {
	Time     string `json:"time"`
	Uplink   int64  `json:"uplink"`
	Downlink int64  `json:"downlink"`
}

// RankingItem 排行项
type RankingItem struct {
	Name     string `json:"name"`
	Traffic  int64  `json:"traffic"`
	Uplink   int64  `json:"uplink"`
	Downlink int64  `json:"downlink"`
}

// HandleGetSystemStats 处理获取系统统计
// GET /api/stats
func (h *StatsHandler) HandleGetSystemStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 获取所有 Slave
	slaves, err := h.db.ListSlaves()
	if err != nil {
		log.Printf("[StatsHandler] 获取 Slave 列表失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取统计失败")
		return
	}

	// 统计在线/离线数量
	var onlineCount, offlineCount int
	for _, slave := range slaves {
		if slave.Status == model.SlaveStatusOnline {
			onlineCount++
		} else {
			offlineCount++
		}
	}

	// 获取所有流量统计
	allStats, err := h.db.GetAllTrafficStats()
	if err != nil {
		log.Printf("[StatsHandler] 获取流量统计失败: %v", err)
		allStats = []*model.TrafficStats{}
	}

	// 计算总流量
	var totalUplink, totalDownlink int64
	for _, stat := range allStats {
		totalUplink += stat.TotalUplink
		totalDownlink += stat.TotalDownlink
	}

	// 注意：今日/本月流量需要额外的数据支持（时间范围过滤）
	// 当前简化为使用总流量
	response := SystemStatsResponse{
		TotalSlaves:      len(slaves),
		OnlineSlaves:     onlineCount,
		OfflineSlaves:    offlineCount,
		ActiveConnections: 0, // 需要额外数据源
		TotalTraffic: TrafficSummary{
			Uplink:   totalUplink,
			Downlink: totalDownlink,
		},
		TodayTraffic: TrafficSummary{
			Uplink:   totalUplink / 30, // 模拟数据
			Downlink: totalDownlink / 30,
		},
		MonthTraffic: TrafficSummary{
			Uplink:   totalUplink,
			Downlink: totalDownlink,
		},
	}

	WriteSuccess(w, response)
}

// HandleGetTrafficStats 处理获取流量统计详情
// GET /api/traffic/stats
func (h *StatsHandler) HandleGetTrafficStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 获取所有流量统计
	allStats, err := h.db.GetAllTrafficStats()
	if err != nil {
		log.Printf("[StatsHandler] 获取流量统计失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取统计失败")
		return
	}

	// 获取所有 Slave
	slaves, err := h.db.ListSlaves()
	if err != nil {
		log.Printf("[StatsHandler] 获取 Slave 列表失败: %v", err)
		slaves = []*model.Slave{}
	}

	// 创建 Slave ID 到 Name 的映射
	slaveMap := make(map[int64]string)
	for _, slave := range slaves {
		slaveMap[slave.ID] = slave.Name
	}

	// 按 Slave 汇总流量
	slaveTraffic := make(map[int64]*RankingItem)
	nodeTraffic := make(map[string]*RankingItem)

	for _, stat := range allStats {
		slaveName := slaveMap[stat.SlaveID]
		if slaveName == "" {
			slaveName = "Unknown"
		}

		// Slave 排行
		if item, ok := slaveTraffic[stat.SlaveID]; ok {
			item.Uplink += stat.TotalUplink
			item.Downlink += stat.TotalDownlink
			item.Traffic += stat.TotalUplink + stat.TotalDownlink
		} else {
			slaveTraffic[stat.SlaveID] = &RankingItem{
				Name:     slaveName,
				Uplink:   stat.TotalUplink,
				Downlink: stat.TotalDownlink,
				Traffic:  stat.TotalUplink + stat.TotalDownlink,
			}
		}

		// 节点（Inbound）排行
		nodeKey := stat.InboundTag
		if item, ok := nodeTraffic[nodeKey]; ok {
			item.Uplink += stat.TotalUplink
			item.Downlink += stat.TotalDownlink
			item.Traffic += stat.TotalUplink + stat.TotalDownlink
		} else {
			nodeTraffic[nodeKey] = &RankingItem{
				Name:     stat.InboundTag,
				Uplink:   stat.TotalUplink,
				Downlink: stat.TotalDownlink,
				Traffic:  stat.TotalUplink + stat.TotalDownlink,
			}
		}
	}

	// 转换为数组并排序
	slaveRanking := make([]RankingItem, 0, len(slaveTraffic))
	for _, item := range slaveTraffic {
		slaveRanking = append(slaveRanking, *item)
	}
	// 简单排序：按流量降序
	for i := 0; i < len(slaveRanking)-1; i++ {
		for j := i + 1; j < len(slaveRanking); j++ {
			if slaveRanking[j].Traffic > slaveRanking[i].Traffic {
				slaveRanking[i], slaveRanking[j] = slaveRanking[j], slaveRanking[i]
			}
		}
	}

	nodeRanking := make([]RankingItem, 0, len(nodeTraffic))
	for _, item := range nodeTraffic {
		nodeRanking = append(nodeRanking, *item)
	}
	// 简单排序：按流量降序
	for i := 0; i < len(nodeRanking)-1; i++ {
		for j := i + 1; j < len(nodeRanking); j++ {
			if nodeRanking[j].Traffic > nodeRanking[i].Traffic {
				nodeRanking[i], nodeRanking[j] = nodeRanking[j], nodeRanking[i]
			}
		}
	}

	// 生成模拟实时数据（最近60分钟）
	realtimeData := make([]RealtimeDataPoint, 60)
	now := time.Now()
	for i := 0; i < 60; i++ {
		t := now.Add(time.Duration(-60+i) * time.Minute)
		realtimeData[i] = RealtimeDataPoint{
			Time:     t.Format("15:04"),
			Uplink:   0, // 实际应从数据库或缓存获取
			Downlink: 0,
		}
	}

	// 计算今日/本月流量（简化版）
	var totalUplink, totalDownlink int64
	for _, stat := range allStats {
		totalUplink += stat.TotalUplink
		totalDownlink += stat.TotalDownlink
	}

	response := TrafficStatsResponse{
		TodayTraffic: TrafficSummary{
			Uplink:   totalUplink / 30, // 模拟数据
			Downlink: totalDownlink / 30,
		},
		MonthTraffic: TrafficSummary{
			Uplink:   totalUplink,
			Downlink: totalDownlink,
		},
		RealtimeData: realtimeData,
		SlaveRanking: slaveRanking,
		NodeRanking:  nodeRanking,
	}

	WriteSuccess(w, response)
}

// HandleGetTrafficHistory 处理获取流量历史
// GET /api/traffic/history
func (h *StatsHandler) HandleGetTrafficHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}

	// 从查询参数获取时间范围
	// startTime := r.URL.Query().Get("start")
	// endTime := r.URL.Query().Get("end")

	// 获取所有流量统计（简化版，实际应支持时间范围过滤）
	allStats, err := h.db.GetAllTrafficStats()
	if err != nil {
		log.Printf("[StatsHandler] 获取流量历史失败: %v", err)
		WriteError(w, http.StatusInternalServerError, "获取历史失败")
		return
	}

	// 按天汇总（简化版，实际需要时间序列数据）
	type DailyTraffic struct {
		Date     string         `json:"date"`
		Traffic  TrafficSummary `json:"traffic"`
	}

	// 生成最近7天的模拟数据
	history := make([]DailyTraffic, 7)
	now := time.Now()
	var totalUplink, totalDownlink int64
	for _, stat := range allStats {
		totalUplink += stat.TotalUplink
		totalDownlink += stat.TotalDownlink
	}

	for i := 0; i < 7; i++ {
		date := now.AddDate(0, 0, -6+i)
		history[i] = DailyTraffic{
			Date: date.Format("2006-01-02"),
			Traffic: TrafficSummary{
				Uplink:   totalUplink / 7,
				Downlink: totalDownlink / 7,
			},
		}
	}

	WriteSuccess(w, map[string]interface{}{
		"history": history,
		"total":   len(history),
	})
}

// Router 路由分发器
func (h *StatsHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// GET /api/stats
	if path == "/api/stats" && r.Method == http.MethodGet {
		h.HandleGetSystemStats(w, r)
		return
	}

	// GET /api/traffic/stats
	if path == "/api/traffic/stats" && r.Method == http.MethodGet {
		h.HandleGetTrafficStats(w, r)
		return
	}

	// GET /api/traffic/history
	if path == "/api/traffic/history" && r.Method == http.MethodGet {
		h.HandleGetTrafficHistory(w, r)
		return
	}

	WriteError(w, http.StatusNotFound, "路由不存在")
}
