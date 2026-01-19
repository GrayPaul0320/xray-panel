import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatBytes } from './TrafficCharts'

/**
 * 排行榜项组件
 */
function RankingItem({ rank, name, value, percentage, showTrend = false, trend = 0 }) {
  const getRankColor = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500'
      case 2:
        return 'bg-gray-400'
      case 3:
        return 'bg-amber-600'
      default:
        return 'bg-dark-700'
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-dark-700 last:border-0 hover:bg-dark-800 transition-colors px-2 rounded">
      {/* 排名 */}
      <div className={`w-8 h-8 rounded-full ${getRankColor(rank)} flex items-center justify-center flex-shrink-0`}>
        <span className={`text-sm font-bold ${rank <= 3 ? 'text-white' : 'text-gray-400'}`}>
          {rank}
        </span>
      </div>

      {/* 名称 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{name}</p>
      </div>

      {/* 值 */}
      <div className="text-right">
        <p className="text-sm font-semibold text-primary-400">
          {formatBytes(value)}
        </p>
        {percentage !== undefined && (
          <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
        )}
      </div>

      {/* 趋势 */}
      {showTrend && (
        <div className="flex-shrink-0">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : trend < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-400" />
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Slave 流量排行榜
 * @param {Array} data - 排行数据
 * @param {number} limit - 显示数量
 */
export function SlaveRankingList({ data = [], limit = 5 }) {
  // 计算总流量用于百分比
  const totalTraffic = data.reduce((sum, item) => sum + (item.total_traffic || item.traffic || 0), 0)

  // 取前 N 名
  const topData = data.slice(0, limit)

  return (
    <div className="space-y-1">
      {topData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">暂无数据</p>
        </div>
      ) : (
        topData.map((item, index) => {
          const traffic = item.total_traffic || item.traffic || 0
          const percentage = totalTraffic > 0 ? (traffic / totalTraffic) * 100 : 0
          
          return (
            <RankingItem
              key={item.id || item.slave_id || index}
              rank={index + 1}
              name={item.name || item.slave_name}
              value={traffic}
              percentage={percentage}
              showTrend={false}
            />
          )
        })
      )}
    </div>
  )
}

/**
 * 节点流量排行榜
 * @param {Array} data - 排行数据
 * @param {number} limit - 显示数量
 */
export function NodeRankingList({ data = [], limit = 10 }) {
  const totalTraffic = data.reduce((sum, item) => sum + (item.total_traffic || item.traffic || 0), 0)
  const topData = data.slice(0, limit)

  return (
    <div className="space-y-1">
      {topData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">暂无数据</p>
        </div>
      ) : (
        topData.map((item, index) => {
          const traffic = item.total_traffic || item.traffic || 0
          const percentage = totalTraffic > 0 ? (traffic / totalTraffic) * 100 : 0
          
          return (
            <RankingItem
              key={item.id || item.inbound_id || index}
              rank={index + 1}
              name={item.tag || item.inbound_tag}
              value={traffic}
              percentage={percentage}
              showTrend={false}
            />
          )
        })
      )}
    </div>
  )
}

/**
 * 简单排行榜（通用）
 * @param {Array} data - 排行数据 [{ name, value }]
 * @param {number} limit - 显示数量
 * @param {Function} formatter - 值格式化函数
 */
export function SimpleRankingList({ 
  data = [], 
  limit = 5, 
  formatter = (value) => value.toString(),
  showTrend = false 
}) {
  const topData = data.slice(0, limit)

  return (
    <div className="space-y-1">
      {topData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">暂无数据</p>
        </div>
      ) : (
        topData.map((item, index) => (
          <RankingItem
            key={item.id || index}
            rank={index + 1}
            name={item.name}
            value={item.value}
            showTrend={showTrend}
            trend={item.trend}
          />
        ))
      )}
    </div>
  )
}
