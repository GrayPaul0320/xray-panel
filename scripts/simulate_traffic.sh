#!/bin/bash

# 模拟流量上报测试

echo "========================================="
echo "模拟流量上报测试"
echo "========================================="

SLAVE_ID=1
INBOUND_TAG="vmess-in"

# 模拟添加流量数据
echo ""
echo "模拟添加流量数据..."

for i in {1..5}; do
    UPLINK=$((RANDOM * 1024 + 1000000))    # 随机上行流量 (1-33MB)
    DOWNLINK=$((RANDOM * 1024 + 5000000))  # 随机下行流量 (5-165MB)
    
    echo "第 $i 次上报: ↑ $UPLINK bytes, ↓ $DOWNLINK bytes"
    
    PGPASSWORD=xray_password_123 psql -h localhost -U xray_admin -d xray_panel -c "
    INSERT INTO traffic_stats (slave_id, inbound_tag, total_uplink, total_downlink, updated_at)
    VALUES ($SLAVE_ID, '$INBOUND_TAG', $UPLINK, $DOWNLINK, NOW())
    ON CONFLICT (slave_id, inbound_tag) 
    DO UPDATE SET
        total_uplink = traffic_stats.total_uplink + EXCLUDED.total_uplink,
        total_downlink = traffic_stats.total_downlink + EXCLUDED.total_downlink,
        updated_at = EXCLUDED.updated_at;
    " > /dev/null
    
    sleep 1
done

echo ""
echo "✓ 模拟数据添加完成"

# 查看结果
echo ""
echo "当前流量统计:"
PGPASSWORD=xray_password_123 psql -h localhost -U xray_admin -d xray_panel -c "
SELECT 
    slave_id,
    inbound_tag,
    total_uplink,
    total_downlink,
    ROUND(total_uplink / 1024.0 / 1024.0, 2) as uplink_mb,
    ROUND(total_downlink / 1024.0 / 1024.0, 2) as downlink_mb,
    updated_at
FROM traffic_stats
WHERE slave_id = $SLAVE_ID AND inbound_tag = '$INBOUND_TAG';
"

echo ""
echo "========================================="
echo "测试完成"
echo "========================================="
