import { useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

/**
 * 格式化字节数
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 格式化速率
 */
export const formatRate = (bytesPerSecond) => {
  return formatBytes(bytesPerSecond) + '/s'
}

/**
 * 自定义 Tooltip 组件
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm text-gray-400 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-sm text-gray-300">
              {entry.name}: {formatBytes(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

/**
 * 实时流量图表（折线图）
 * @param {Array} data - 数据点数组 [{ time, uplink, downlink }]
 */
export function TrafficLineChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="time" 
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatBytes(value)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ fontSize: '14px', color: '#D1D5DB' }}
        />
        <Line
          type="monotone"
          dataKey="uplink"
          name="上行"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="downlink"
          name="下行"
          stroke="#10B981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * 流量面积图
 * @param {Array} data - 数据点数组
 */
export function TrafficAreaChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="time" 
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatBytes(value)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '14px', color: '#D1D5DB' }} />
        <Area
          type="monotone"
          dataKey="uplink"
          name="上行"
          stackId="1"
          stroke="#3B82F6"
          fill="#3B82F6"
          fillOpacity={0.3}
        />
        <Area
          type="monotone"
          dataKey="downlink"
          name="下行"
          stackId="1"
          stroke="#10B981"
          fill="#10B981"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * Slave 流量排行柱状图
 * @param {Array} data - 排行数据 [{ name, traffic }]
 */
export function SlaveRankingChart({ data = [] }) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      name: item.name || item.slave_name,
      traffic: item.total_traffic || item.traffic || 0
    }))
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="name" 
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatBytes(value)}
        />
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 shadow-xl">
                  <p className="text-sm font-medium text-gray-300 mb-1">
                    {payload[0].payload.name}
                  </p>
                  <p className="text-sm text-primary-400">
                    总流量: {formatBytes(payload[0].value)}
                  </p>
                </div>
              )
            }
            return null
          }}
        />
        <Bar 
          dataKey="traffic" 
          fill="#3B82F6" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * 节点流量排行柱状图（横向）
 * @param {Array} data - 排行数据 [{ tag, traffic }]
 */
export function NodeRankingChart({ data = [] }) {
  const chartData = useMemo(() => {
    return data.slice(0, 10).map(item => ({
      tag: item.tag || item.inbound_tag,
      traffic: item.total_traffic || item.traffic || 0
    }))
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart 
        data={chartData}
        layout="vertical"
        margin={{ left: 20, right: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          type="number"
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatBytes(value)}
        />
        <YAxis 
          type="category"
          dataKey="tag"
          stroke="#9CA3AF"
          style={{ fontSize: '12px' }}
          width={100}
        />
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-3 shadow-xl">
                  <p className="text-sm font-medium text-gray-300 mb-1">
                    {payload[0].payload.tag}
                  </p>
                  <p className="text-sm text-green-400">
                    总流量: {formatBytes(payload[0].value)}
                  </p>
                </div>
              )
            }
            return null
          }}
        />
        <Bar 
          dataKey="traffic" 
          fill="#10B981" 
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * 迷你趋势图（用于卡片）
 * @param {Array} data - 简单数据点 [number]
 * @param {string} color - 线条颜色
 */
export function MiniTrendChart({ data = [], color = '#3B82F6' }) {
  const chartData = data.map((value, index) => ({ value, index }))
  
  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
