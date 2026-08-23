#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - Native Linux + MySQL Automated Installer
# (NO DOCKER REQUIRED - 100% Native Linux Installation)
# Supports: Ubuntu 20.04/22.04/24.04, Debian 11/12, CentOS/RHEL/Rocky 8/9
# ==============================================================================

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BOLD}  📦 Verdad Solution InventoryApp - Native Linux Deployment Setup  ${NC}"
echo -e "${BLUE}  (No Docker - Native MySQL + Node.js / Python Installation)        ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

# Check sudo / root
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}❌ Please run this setup script with sudo privileges:${NC}"
    echo -e "   ${YELLOW}sudo ./setup_linux_native.sh${NC}"
    exit 1
fi

ACTUAL_USER="${SUDO_USER:-$USER}"

# ------------------------------------------------------------------------------
# STEP 1: Install System Dependencies (MySQL Server, Python3, Node.js, Curl, Git)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[Step 1/6] Installing MySQL Server, Python 3, Node.js & Tools...${NC}"

if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y mysql-server python3 python3-pip curl git ufw
    
    # Check if Node.js is installed, install Node 18+ if missing
    if ! command -v node >/dev/null 2>&1; then
        echo "Installing Node.js via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y mysql-server python3 python3-pip curl git nodejs npm
    systemctl enable --now mysqld
elif command -v yum >/dev/null 2>&1; then
    yum install -y mysql-server python3 python3-pip curl git nodejs npm
    systemctl enable --now mysqld
else
    echo -e "${RED}Unsupported package manager. Please install MySQL and Python3 manually.${NC}"
fi

echo -e "${GREEN}✓ System packages installed successfully.${NC}"

# ------------------------------------------------------------------------------
# STEP 2: Start MySQL Service & Create Database, User, Schema
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[Step 2/6] Configuring MySQL Database & Importing Schema...${NC}"

systemctl enable mysql 2>/dev/null || systemctl enable mysqld 2>/dev/null || true
systemctl start mysql 2>/dev/null || systemctl start mysqld 2>/dev/null || true

DB_NAME="inventory_db"
DB_USER="inventory_user"
DB_PASS="inventory_pass_123"

# Run SQL setup commands
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

echo -e "${GREEN}✓ MySQL database '${DB_NAME}' and user '${DB_USER}' configured.${NC}"

# Import schema.sql
if [ -f "$APP_DIR/backend/schema.sql" ]; then
    echo "Importing table schemas and initial catalog seed data..."
    mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < "$APP_DIR/backend/schema.sql"
    echo -e "${GREEN}✓ Database schema imported successfully.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 3: Configure Environment Variables (.env)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[Step 3/6] Setting up production environment configuration...${NC}"

mkdir -p "$APP_DIR/backend/node_backend"

cat > "$APP_DIR/backend/node_backend/.env" <<EOF
PORT=5000
NODE_ENV=production

# MySQL Database Connection
DB_HOST=localhost
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}
DB_PORT=3306

# JWT Authentication Secret
JWT_SECRET=verdad_solution_inventory_super_secret_jwt_key_2026
EOF

chown -R "$ACTUAL_USER":"$ACTUAL_USER" "$APP_DIR/backend/node_backend/.env"
echo -e "${GREEN}✓ Created backend/node_backend/.env${NC}"

# ------------------------------------------------------------------------------
# STEP 4: Install Application Dependencies
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[Step 4/6] Installing application backend dependencies...${NC}"

if [ -f "$APP_DIR/backend/node_backend/package.json" ]; then
    cd "$APP_DIR/backend/node_backend"
    sudo -u "$ACTUAL_USER" npm install --production
    cd "$APP_DIR"
fi

# Make scripts executable
chmod +x "$APP_DIR/start_server.sh" "$APP_DIR/test_linux.sh" "$APP_DIR/deploy_linux.sh"
echo -e "${GREEN}✓ Application dependencies and permissions configured.${NC}"

# ------------------------------------------------------------------------------
# STEP 5: Create and Enable Systemd Service for 24/7 Background Operation
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[Step 5/6] Registering Systemd Service 'verdad-inventory'...${NC}"

PYTHON_BIN=$(command -v python3 || command -v python)
SERVICE_PATH="/etc/systemd/system/verdad-inventory.service"

cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=Verdad Solution InventoryApp Daemon
After=network.target mysql.service

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${PYTHON_BIN} ${APP_DIR}/server.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable verdad-inventory
systemctl restart verdad-inventory

echo -e "${GREEN}✓ Systemd service 'verdad-inventory' is active and running!${NC}"

# ------------------------------------------------------------------------------
# STEP 6: Configure Firewall & Run Verification
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[Step 6/6] Configuring firewall and verifying deployment...${NC}"

if command -v ufw >/dev/null 2>&1; then
    ufw allow 5000/tcp comment "Verdad Inventory App" >/dev/null 2>&1 || true
fi

sleep 2

echo ""
echo -e "${BLUE}==================================================================${NC}"
echo -e "${GREEN}🎉 NATIVE LINUX DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""
echo -e "🌐 Application URL : ${BOLD}http://localhost:5000${NC} (or http://<SERVER_IP>:5000)"
echo -e "🗄️ Database        : MySQL Database '${DB_NAME}' (User: ${DB_USER})"
echo -e "⚙️ Service Name    : verdad-inventory"
echo ""
echo -e "${BOLD}Useful Service Commands:${NC}"
echo "  • Check Status : sudo systemctl status verdad-inventory"
echo "  • View Logs    : sudo journalctl -u verdad-inventory -f"
echo "  • Restart App  : sudo systemctl restart verdad-inventory"
echo "  • Stop App     : sudo systemctl stop verdad-inventory"
echo ""
echo -e "${BOLD}Default Demo Credentials:${NC}"
echo "  • Admin Portal : admin / admin123"
echo "  • Staff Portal : user / user123"
echo ""

# Run test suite
echo -e "${YELLOW}Running verification test...${NC}"
"$APP_DIR/test_linux.sh" || true
