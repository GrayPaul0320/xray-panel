#!/bin/bash

# 初始化 PostgreSQL 数据库脚本

echo "初始化 Xray Panel 数据库..."

# 配置变量
DB_NAME="xray_panel"
DB_USER="xray_admin"
DB_PASSWORD="xray_password_123"

# 创建数据库和用户
sudo -u postgres psql << EOF
-- 创建数据库
CREATE DATABASE $DB_NAME;

-- 创建用户
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- 连接到新数据库
\c $DB_NAME

-- 授予 schema 权限
GRANT ALL ON SCHEMA public TO $DB_USER;

EOF

echo "✓ 数据库初始化完成"
echo ""
echo "数据库连接信息："
echo "  数据库名: $DB_NAME"
echo "  用户名: $DB_USER"
echo "  密码: $DB_PASSWORD"
echo ""
echo "连接字符串："
echo "  postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?sslmode=disable"
