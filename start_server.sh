#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - Linux Startup Script
# ==============================================================================

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

PORT=${PORT:-5000}

echo "=================================================================="
echo "  🚀 Starting Verdad Solution InventoryApp on Linux"
echo "  📂 Working Directory: $APP_DIR"
echo "  🌐 Target Port: http://0.0.0.0:$PORT"
echo "=================================================================="

# Check for Python 3
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python 3 is required to run the server."
    echo "👉 Please install Python 3: sudo apt update && sudo apt install -y python3"
    exit 1
fi

echo "✅ Using Python runtime: $($PYTHON_CMD --version)"

# Optional: Node.js Express backend check
if [ -f "$APP_DIR/backend/node_backend/server.js" ] && [ "$USE_NODE" = "true" ]; then
    echo "📦 Starting Node.js backend..."
    cd "$APP_DIR/backend/node_backend"
    if [ ! -d "node_modules" ]; then
        echo "Installing npm dependencies..."
        npm install --production
    fi
    exec node server.js
fi

# Run unified server
echo "⚡ Launching application server..."
exec $PYTHON_CMD "$APP_DIR/server.py"
