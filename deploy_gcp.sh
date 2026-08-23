#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - 2-Tier GCP Deployment Automation
# Deploys Database VM + Web/App VM to Google Cloud Platform via gcloud CLI
# ==============================================================================
set -e

# Default settings
PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "mivafinalyearproject")}
REGION=${GCP_REGION:-"europe-west1"}
ZONE=${GCP_ZONE:-"europe-west1-b"}
NETWORK_NAME="inventory-vpc"
SUBNET_NAME="inventory-subnet"
SUBNET_RANGE="10.10.0.0/24"
MACHINE_TYPE="e2-micro"

echo "======================================================"
echo "  Deploying Verdad Solution InventoryApp to GCP"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Zone    : $ZONE"
echo "======================================================"

# 1. Ensure gcloud is configured
gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

# 2. Enable Compute Engine API if needed
echo "Step 1/6: Ensuring Compute Engine API is enabled..."
gcloud services enable compute.googleapis.com

# 3. Create VPC Network and Subnet if not exists
echo "Step 2/6: Creating VPC Network ($NETWORK_NAME)..."
if ! gcloud compute networks describe "$NETWORK_NAME" &>/dev/null; then
    gcloud compute networks create "$NETWORK_NAME" --subnet-mode=custom
fi

if ! gcloud compute networks subnets describe "$SUBNET_NAME" --region="$REGION" &>/dev/null; then
    gcloud compute networks subnets create "$SUBNET_NAME" \
        --network="$NETWORK_NAME" \
        --region="$REGION" \
        --range="$SUBNET_RANGE"
fi

# 4. Create Firewall Rules
echo "Step 3/6: Setting up Firewall Rules..."
if ! gcloud compute firewall-rules describe "inventory-allow-web" &>/dev/null; then
    gcloud compute firewall-rules create "inventory-allow-web" \
        --network="$NETWORK_NAME" \
        --direction=INGRESS \
        --priority=1000 \
        --action=ALLOW \
        --rules=tcp:80,tcp:443,tcp:22 \
        --source-ranges=0.0.0.0/0 \
        --target-tags=inventory-web
fi

if ! gcloud compute firewall-rules describe "inventory-allow-internal-db" &>/dev/null; then
    gcloud compute firewall-rules create "inventory-allow-internal-db" \
        --network="$NETWORK_NAME" \
        --direction=INGRESS \
        --priority=1000 \
        --action=ALLOW \
        --rules=tcp:3306,tcp:22 \
        --source-tags=inventory-web \
        --target-tags=inventory-db
fi

# 5. Reserve Static External IP for Web VM
echo "Step 4/6: Allocating Static External IP..."
if ! gcloud compute addresses describe "inventory-web-static-ip" --region="$REGION" &>/dev/null; then
    gcloud compute addresses create "inventory-web-static-ip" --region="$REGION"
fi
WEB_STATIC_IP=$(gcloud compute addresses describe "inventory-web-static-ip" --region="$REGION" --format="value(address)")
echo "Reserved Web Public IP: $WEB_STATIC_IP"

# 6. Launch Database VM (inventory-db)
echo "Step 5/6: Launching Database VM (inventory-db)..."
DB_PASS="StrongGcpPass2026!"

DB_STARTUP_SCRIPT=$(cat << 'EOF'
#!/bin/bash
set -e
exec > /var/log/startup-script.log 2>&1
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y mysql-server git

sed -i 's/127.0.0.1/0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
systemctl restart mysql
systemctl enable mysql

mysql -u root << 'EOSQL'
CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'inventory_app'@'%' IDENTIFIED BY 'StrongGcpPass2026!';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_app'@'%';
FLUSH PRIVILEGES;
EOSQL

git clone https://github.com/lesileugwulebo/t11_webpage.git /tmp/miva_project
mysql -u root inventory_db < /tmp/miva_project/backend/schema.sql
rm -rf /tmp/miva_project
echo "MySQL Database Ready on GCP!"
EOF
)

if ! gcloud compute instances describe "inventory-db" --zone="$ZONE" &>/dev/null; then
    gcloud compute instances create "inventory-db" \
        --zone="$ZONE" \
        --machine-type="$MACHINE_TYPE" \
        --network="$NETWORK_NAME" \
        --subnet="$SUBNET_NAME" \
        --tags=inventory-db \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=20GB \
        --metadata=startup-script="$DB_STARTUP_SCRIPT"
fi

DB_INTERNAL_IP=$(gcloud compute instances describe "inventory-db" --zone="$ZONE" --format="value(networkInterfaces[0].networkIP)")
echo "Database Internal IP: $DB_INTERNAL_IP"

# 7. Launch Web & App VM (inventory-web-app)
echo "Step 6/6: Launching Web & App VM (inventory-web-app)..."
WEB_STARTUP_SCRIPT=$(cat << EOF
#!/bin/bash
set -e
exec > /var/log/startup-script.log 2>&1
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y curl git nginx python3 python3-pip

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

mkdir -p /var/www/inventory-app
git clone https://github.com/lesileugwulebo/t11_webpage.git /var/www/inventory-app
chown -R www-data:www-data /var/www/inventory-app

cd /var/www/inventory-app/backend/node_backend
npm install --production

cat << 'ENVFILE' > /var/www/inventory-app/backend/node_backend/.env
PORT=5000
NODE_ENV=production
DB_HOST=$DB_INTERNAL_IP
DB_PORT=3306
DB_USER=inventory_app
DB_PASS=StrongGcpPass2026!
DB_NAME=inventory_db
JWT_SECRET=production_gcp_deployment_secret_key_2026
ENVFILE

cat << 'SERVICEFILE' > /etc/systemd/system/inventory-app.service
[Unit]
Description=Verdad Solution InventoryApp Node.js Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/inventory-app/backend/node_backend
ExecStart=/usr/bin/node /var/www/inventory-app/backend/node_backend/server.js
Restart=always
RestartSec=5
EnvironmentFile=/var/www/inventory-app/backend/node_backend/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEFILE

systemctl daemon-reload
systemctl enable --now inventory-app

cat << 'NGINXFILE' > /etc/nginx/sites-available/inventory-app
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/inventory-app/frontend;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXFILE

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo "Verdad Solution InventoryApp successfully running on GCP!"
EOF
)

if ! gcloud compute instances describe "inventory-web-app" --zone="$ZONE" &>/dev/null; then
    gcloud compute instances create "inventory-web-app" \
        --zone="$ZONE" \
        --machine-type="$MACHINE_TYPE" \
        --network="$NETWORK_NAME" \
        --subnet="$SUBNET_NAME" \
        --address="$WEB_STATIC_IP" \
        --tags=inventory-web \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=20GB \
        --metadata=startup-script="$WEB_STARTUP_SCRIPT"
fi

echo ""
echo "======================================================"
echo "  🎉 DEPLOYMENT TO GCP COMPLETE!"
echo "======================================================"
echo "  Application URL       : http://$WEB_STATIC_IP/"
echo "  Web Public Static IP  : $WEB_STATIC_IP"
echo "  Database Internal IP  : $DB_INTERNAL_IP"
echo "  SSH Web Instance      : gcloud compute ssh inventory-web-app --zone=$ZONE"
echo "  SSH DB Instance       : gcloud compute ssh inventory-db --zone=$ZONE"
echo "======================================================"
echo "  👉 Microsoft Entra ID (Azure AD) Redirect URI:"
echo "     http://$WEB_STATIC_IP/"
echo "======================================================"
