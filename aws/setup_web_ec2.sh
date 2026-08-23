#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - AWS EC2 (Instance 1: Nginx & Web Application)
# Run this script on the Web/App EC2 Instance
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BOLD}  🌐 AWS EC2 Web & Nginx Application Server Setup                 ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

# Verify sudo
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}❌ Please run with sudo: sudo bash setup_web_ec2.sh <DATABASE_EC2_PRIVATE_IP>${NC}"
    exit 1
fi

DB_PRIVATE_IP="$1"
if [ -z "$DB_PRIVATE_IP" ]; then
    echo -e "${YELLOW}⚠️ No Database EC2 Private IP provided as argument.${NC}"
    read -p "Enter the Private IP of your Database EC2 instance (e.g. 10.0.2.100 or 172.31.x.x): " DB_PRIVATE_IP
fi

if [ -z "$DB_PRIVATE_IP" ]; then
    echo -e "${RED}❌ Database EC2 Private IP is required for the web application to connect.${NC}"
    exit 1
fi

ACTUAL_USER="${SUDO_USER:-ubuntu}"
INSTALL_DIR="/home/${ACTUAL_USER}/t11_webpage"

# 1. Install Nginx, Python 3, Node.js, Git, Tools
echo -e "${YELLOW}[1/5] Installing Nginx, Python 3, Node.js, Git & Tools...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx python3 python3-pip curl git mysql-client ufw

# Install Node.js 18 if not available
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# 2. Clone Repository or Update Existing
echo -e "${YELLOW}[2/5] Deploying Verdad Solution InventoryApp codebase...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation in $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    sudo -u "$ACTUAL_USER" git pull origin main
else
    echo "Cloning repository from GitHub to $INSTALL_DIR..."
    sudo -u "$ACTUAL_USER" git clone https://github.com/lesileugwulebo/t11_webpage.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 3. Create .env configuration pointing to Database EC2 Private IP
echo -e "${YELLOW}[3/5] Configuring environment variables pointing to Database EC2 ($DB_PRIVATE_IP)...${NC}"
mkdir -p "$INSTALL_DIR/backend/node_backend"

cat > "$INSTALL_DIR/backend/node_backend/.env" <<EOF
PORT=5000
NODE_ENV=production

# Remote Database EC2 Connection
DB_HOST=${DB_PRIVATE_IP}
DB_USER=inventory_user
DB_PASSWORD=inventory_pass_123
DB_NAME=inventory_db
DB_PORT=3306

# JWT Authentication Secret
JWT_SECRET=verdad_solution_inventory_super_secret_jwt_key_2026
EOF

chown -R "$ACTUAL_USER":"$ACTUAL_USER" "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/start_server.sh" "$INSTALL_DIR/test_linux.sh"

# Install backend dependencies if package.json present
if [ -f "$INSTALL_DIR/backend/node_backend/package.json" ]; then
    cd "$INSTALL_DIR/backend/node_backend"
    sudo -u "$ACTUAL_USER" npm install --production
    cd "$INSTALL_DIR"
fi

# 4. Setup Systemd Service for 24/7 background operation
echo -e "${YELLOW}[4/5] Setting up Systemd Service 'verdad-inventory'...${NC}"
PYTHON_BIN=$(command -v python3 || command -v python)
SERVICE_PATH="/etc/systemd/system/verdad-inventory.service"

cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=Verdad Solution InventoryApp Server
After=network.target

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${PYTHON_BIN} ${INSTALL_DIR}/server.py
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

# 5. Configure Nginx Reverse Proxy on Port 80
echo -e "${YELLOW}[5/5] Configuring Nginx Reverse Proxy (Port 80 -> Port 5000)...${NC}"
NGINX_CONF="/etc/nginx/sites-available/verdad-inventory.conf"

cat > "$NGINX_CONF" <<'EOF'
server {
    listen 80;
    server_name _;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1000;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Allow traffic in UFW if enabled
if ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}  🎉 AWS Web & Nginx EC2 Setup Complete!                          ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
PUBLIC_IP=$(curl -s https://checkip.amazonaws.com || curl -s https://ifconfig.me || echo "<WEB_EC2_PUBLIC_IP>")
echo -e "  🌐 Public Application URL : ${BOLD}http://${PUBLIC_IP}${NC}"
echo -e "  🗄️ Connected Database IP  : ${BOLD}${DB_PRIVATE_IP}${NC}"
echo -e "  ⚙️ Nginx Reverse Proxy     : ${BOLD}Port 80 -> Port 5000${NC}"
echo ""
echo -e "${BOLD}Default Demo Credentials:${NC}"
echo "  • Admin Portal : admin / admin123"
echo "  • Staff Portal : user / user123"
echo ""
