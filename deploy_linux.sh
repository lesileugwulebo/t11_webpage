#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - Automated Linux Deployment & Installer
# Supported OS: Ubuntu, Debian, CentOS, RHEL, Rocky Linux, Fedora, Arch Linux
# ==============================================================================

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}  📦 Verdad Solution InventoryApp - Linux Deployment Setup        ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

# 1. Check Root / Sudo status
IS_ROOT=false
if [ "$(id -u)" -eq 0 ]; then
    IS_ROOT=true
fi

# 2. Check Python 3 and basic tools
echo -e "${YELLOW}[1/4] Checking Linux environment requirements...${NC}"

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
    echo -e "${RED}Python 3 is not installed.${NC}"
    if [ "$IS_ROOT" = true ]; then
        echo "Attempting to install Python 3..."
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update && apt-get install -y python3 python3-pip curl
        elif command -v yum >/dev/null 2>&1; then
            yum install -y python3 python3-pip curl
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y python3 python3-pip curl
        fi
    else
        echo "Please run: sudo apt install -y python3 curl"
        exit 1
    fi
fi

PYTHON_BIN=$(command -v python3 || command -v python)
echo -e "${GREEN}✓ Python found: $($PYTHON_BIN --version)${NC}"

# 3. Ensure executable permissions
echo -e "${YELLOW}[2/4] Setting execution permissions...${NC}"
chmod +x "$APP_DIR/start_server.sh" || true
chmod +x "$APP_DIR/test_linux.sh" || true
echo -e "${GREEN}✓ Shell scripts are now executable.${NC}"

# 4. Optional: Setup systemd service if requested and root
if [ "$1" = "--systemd" ] && [ "$IS_ROOT" = true ]; then
    echo -e "${YELLOW}[3/4] Installing systemd service 'inventory-app'...${NC}"
    SERVICE_PATH="/etc/systemd/system/inventory-app.service"
    
    cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=Verdad Solution InventoryApp Service
After=network.target

[Service]
Type=simple
User=$(logname || echo "root")
WorkingDirectory=$APP_DIR
ExecStart=$PYTHON_BIN $APP_DIR/server.py
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
    systemctl enable inventory-app
    systemctl restart inventory-app
    echo -e "${GREEN}✓ Systemd service 'inventory-app' installed and started!${NC}"
    echo "  Status check: sudo systemctl status inventory-app"
else
    echo -e "${YELLOW}[3/4] Skipping systemd auto-registration (run with sudo ./deploy_linux.sh --systemd for auto-service).${NC}"
fi

# 5. Summary & Usage
echo ""
echo -e "${BLUE}==================================================================${NC}"
echo -e "${GREEN}✨ Deployment Preparation Complete!${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""
echo "🚀 To run the server directly on Linux:"
echo "   ./start_server.sh"
echo ""
echo "🧪 To run the automated Linux integration tests:"
echo "   ./test_linux.sh"
echo ""
echo "🐳 To run with Docker Compose:"
echo "   docker compose up -d"
echo ""
echo -e "${YELLOW}Credentials:${NC}"
echo "   Admin Portal: admin / admin123"
echo "   Staff Portal: user / user123"
echo ""
