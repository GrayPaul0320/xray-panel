#!/bin/bash
# Xray Panel Slave 一键安装脚本
# Slave Name: graypaul

set -e

echo "========================================"
echo "Xray Panel Slave 安装程序"
echo "========================================"

# 创建安装目录
INSTALL_DIR="/opt/xray-panel"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 下载 Slave 程序
echo "正在下载 Slave 程序..."
wget -O slave https://github.com/YOUR_REPO/releases/latest/download/slave || curl -L -o slave https://github.com/YOUR_REPO/releases/latest/download/slave
chmod +x slave

# 下载 Xray Core
echo "正在下载 Xray Core..."
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
  XRAY_FILE="Xray-linux-64.zip"
elif [ "$ARCH" = "aarch64" ]; then
  XRAY_FILE="Xray-linux-arm64-v8a.zip"
else
  echo "不支持的架构: $ARCH"
  exit 1
fi

wget -O xray.zip "https://github.com/XTLS/Xray-core/releases/latest/download/$XRAY_FILE" || \
curl -L -o xray.zip "https://github.com/XTLS/Xray-core/releases/latest/download/$XRAY_FILE"
unzip -o xray.zip xray
rm xray.zip
chmod +x xray

# 创建配置文件
cat > config.json <<'CONFIGEOF'
{
  "log": { "loglevel": "warning" },
  "inbounds": [],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" }
  ]
}
CONFIGEOF

# 创建 systemd 服务
cat > /etc/systemd/system/xray-panel-slave.service <<'SERVICEEOF'
[Unit]
Description=Xray Panel Slave
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xray-panel
ExecStart=/opt/xray-panel/slave -xray-path /opt/xray-panel/xray -master "ws://localhost:9091/ws" -token "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzbGF2ZV9pZCI6MjAsInNsYXZlX25hbWUiOiJncmF5cGF1bCIsImlzcyI6InhyYXktcGFuZWwtbWFzdGVyIiwiZXhwIjoxNzY4ODk1MTI2LCJuYmYiOjE3Njg4MDg3MjYsImlhdCI6MTc2ODgwODcyNn0.eDRJcGiDko2FXPAJjnvLJGzhRcDmsmwxW-Ly3RM8c1Y" -config /opt/xray-panel/config.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

# 启动服务
echo "正在启动服务..."
systemctl daemon-reload
systemctl enable xray-panel-slave
systemctl start xray-panel-slave

echo "========================================"
echo "✓ 安装完成！"
echo "========================================"
echo "查看状态: systemctl status xray-panel-slave"
echo "查看日志: journalctl -u xray-panel-slave -f"
echo "========================================"