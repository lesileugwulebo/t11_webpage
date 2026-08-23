#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - AWS EC2 (Instance 2: Dedicated MySQL Database)
# Run this script on the Database EC2 Instance
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BOLD}  🗄️ AWS EC2 Database Server Setup (MySQL 8.0)                    ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

# Verify sudo
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}❌ Please run with sudo: sudo bash setup_database_ec2.sh <WEB_EC2_PRIVATE_IP>${NC}"
    exit 1
fi

WEB_PRIVATE_IP="$1"
if [ -z "$WEB_PRIVATE_IP" ]; then
    echo -e "${YELLOW}⚠️ No Web EC2 Private IP provided as argument.${NC}"
    read -p "Enter the Private IP of your Web/App EC2 instance (e.g., 10.0.1.50 or 172.31.x.x): " WEB_PRIVATE_IP
fi

if [ -z "$WEB_PRIVATE_IP" ]; then
    echo -e "${RED}❌ Web EC2 Private IP is required to securely allow database connections.${NC}"
    exit 1
fi

DB_NAME="inventory_db"
DB_USER="inventory_user"
DB_PASS="inventory_pass_123"

# 1. Update & Install MySQL Server
echo -e "${YELLOW}[1/4] Installing MySQL Server & Tools...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y mysql-server curl git ufw

# 2. Configure MySQL to listen on private network (bind-address = 0.0.0.0)
echo -e "${YELLOW}[2/4] Configuring MySQL remote access on private network...${NC}"
MYSQL_CONF="/etc/mysql/mysql.conf.d/mysqld.cnf"
if [ -f "$MYSQL_CONF" ]; then
    sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' "$MYSQL_CONF"
    sed -i 's/^mysqlx-bind-address\s*=.*/mysqlx-bind-address = 0.0.0.0/' "$MYSQL_CONF" || true
fi

systemctl daemon-reload
systemctl enable --now mysql
systemctl restart mysql

# 3. Create Database, User, and Grant Privileges to Web EC2 IP
echo -e "${YELLOW}[3/4] Creating database and granting privileges to Web EC2 ($WEB_PRIVATE_IP)...${NC}"
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Allow connection from the Web EC2 instance Private IP
CREATE USER IF NOT EXISTS '${DB_USER}'@'${WEB_PRIVATE_IP}' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'${WEB_PRIVATE_IP}' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${WEB_PRIVATE_IP}';

-- Also allow localhost connection for local admin operations
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';

FLUSH PRIVILEGES;
EOF

# 4. Import Schema
echo -e "${YELLOW}[4/4] Fetching and importing database schema...${NC}"
SCHEMA_URL="https://raw.githubusercontent.com/lesileugwulebo/t11_webpage/main/backend/schema.sql"
curl -sSL "$SCHEMA_URL" -o /tmp/schema.sql

mysql -u root "${DB_NAME}" < /tmp/schema.sql
rm -f /tmp/schema.sql

# Configure local firewall if ufw active
if ufw status | grep -q "Status: active"; then
    ufw allow from "${WEB_PRIVATE_IP}" to any port 3306 proto tcp comment "Allow MySQL from Web EC2"
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}  🎉 MySQL Database EC2 Setup Complete!                          ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "  Database Name      : ${BOLD}${DB_NAME}${NC}"
echo -e "  Database User      : ${BOLD}${DB_USER}${NC}"
echo -e "  Database Password  : ${BOLD}${DB_PASS}${NC}"
echo -e "  Allowed Client IP  : ${BOLD}${WEB_PRIVATE_IP}${NC}"
echo -e "  MySQL Port         : ${BOLD}3306${NC}"
echo ""
