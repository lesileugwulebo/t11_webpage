# ==============================================================================
# Verdad Solution InventoryApp - 2-Tier GCP Deployment Automation (PowerShell)
# Deploys Database VM + Web/App VM to Google Cloud Platform via gcloud CLI
# ==============================================================================

$ProjectId = $env:GCP_PROJECT_ID
if (-not $ProjectId) {
    $ProjectId = (gcloud config get-value project 2>$null)
    if (-not $ProjectId) { $ProjectId = "mivafinalyearproject" }
}

$Region = "europe-west1"
$Zone = "europe-west1-b"
$NetworkName = "inventory-vpc"
$SubnetName = "inventory-subnet"
$SubnetRange = "10.10.0.0/24"
$MachineType = "e2-micro"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Deploying Verdad Solution InventoryApp to GCP" -ForegroundColor Cyan
Write-Host "  Project : $ProjectId" -ForegroundColor Yellow
Write-Host "  Region  : $Region" -ForegroundColor Yellow
Write-Host "  Zone    : $Zone" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Ensure gcloud is configured
gcloud config set project "$ProjectId" 2>$null
gcloud config set compute/region "$Region" 2>$null
gcloud config set compute/zone "$Zone" 2>$null

# 2. Enable Compute Engine API
Write-Host "Step 1/6: Ensuring Compute Engine API is enabled..." -ForegroundColor Green
gcloud services enable compute.googleapis.com

# 3. Create VPC Network and Subnet
Write-Host "Step 2/6: Creating VPC Network ($NetworkName)..." -ForegroundColor Green
$existingNet = gcloud compute networks list --filter="name=$NetworkName" --format="value(name)"
if (-not $existingNet) {
    Write-Host "Creating custom VPC network $NetworkName..." -ForegroundColor Cyan
    gcloud compute networks create "$NetworkName" --subnet-mode=custom
} else {
    Write-Host "VPC network $NetworkName already exists." -ForegroundColor Cyan
}

$existingSubnet = gcloud compute networks subnets list --network="$NetworkName" --filter="name=$SubnetName" --format="value(name)"
if (-not $existingSubnet) {
    Write-Host "Creating subnet $SubnetName in $Region ($SubnetRange)..." -ForegroundColor Cyan
    gcloud compute networks subnets create "$SubnetName" --network="$NetworkName" --region="$Region" --range="$SubnetRange"
} else {
    Write-Host "Subnet $SubnetName already exists." -ForegroundColor Cyan
}

# 4. Create Firewall Rules
Write-Host "Step 3/6: Setting up Firewall Rules..." -ForegroundColor Green
$existingWebFw = gcloud compute firewall-rules list --filter="name=inventory-allow-web" --format="value(name)"
if (-not $existingWebFw) {
    gcloud compute firewall-rules create "inventory-allow-web" `
        --network="$NetworkName" `
        --direction=INGRESS `
        --priority=1000 `
        --action=ALLOW `
        --rules="tcp:80,tcp:443,tcp:22" `
        --source-ranges="0.0.0.0/0" `
        --target-tags=inventory-web
} else {
    Write-Host "Firewall rule inventory-allow-web already exists." -ForegroundColor Cyan
}

$existingDbFw = gcloud compute firewall-rules list --filter="name=inventory-allow-internal-db" --format="value(name)"
if (-not $existingDbFw) {
    gcloud compute firewall-rules create "inventory-allow-internal-db" `
        --network="$NetworkName" `
        --direction=INGRESS `
        --priority=1000 `
        --action=ALLOW `
        --rules="tcp:3306,tcp:22" `
        --source-tags=inventory-web `
        --target-tags=inventory-db
} else {
    Write-Host "Firewall rule inventory-allow-internal-db already exists." -ForegroundColor Cyan
}

# 5. Reserve Static External IP
Write-Host "Step 4/6: Allocating Static External IP..." -ForegroundColor Green
$existingIp = gcloud compute addresses list --filter="name=inventory-web-static-ip" --format="value(address)"
if (-not $existingIp) {
    gcloud compute addresses create "inventory-web-static-ip" --region="$Region"
    $existingIp = (gcloud compute addresses describe "inventory-web-static-ip" --region="$Region" --format="value(address)").Trim()
}
$WebStaticIp = $existingIp.Trim()
Write-Host "Reserved Web Public IP: $WebStaticIp" -ForegroundColor Yellow

# 6. Launch Database VM (inventory-db)
Write-Host "Step 5/6: Launching Database VM (inventory-db)..." -ForegroundColor Green

$DbStartup = @'
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
'@

$existingDbVm = gcloud compute instances list --filter="name=inventory-db" --format="value(name)"
if (-not $existingDbVm) {
    $DbStartupFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $DbStartupFile -Value $DbStartup -NoNewline
    gcloud compute instances create "inventory-db" `
        --zone="$Zone" `
        --machine-type="$MachineType" `
        --network="$NetworkName" `
        --subnet="$SubnetName" `
        --tags=inventory-db `
        --image-family=ubuntu-2204-lts `
        --image-project=ubuntu-os-cloud `
        --boot-disk-size=20GB `
        --metadata-from-file=startup-script="$DbStartupFile"
    Remove-Item $DbStartupFile -Force
} else {
    Write-Host "Database VM inventory-db already exists." -ForegroundColor Cyan
}

$DbInternalIp = (gcloud compute instances describe "inventory-db" --zone="$Zone" --format="value(networkInterfaces[0].networkIP)").Trim()
Write-Host "Database Internal IP: $DbInternalIp" -ForegroundColor Yellow

# 7. Launch Web & App VM (inventory-web-app)
Write-Host "Step 6/6: Launching Web & App VM (inventory-web-app)..." -ForegroundColor Green

$WebStartup = @"
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
DB_HOST=$DbInternalIp
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
        try_files `$uri `$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
}
NGINXFILE

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo "Verdad Solution InventoryApp successfully running on GCP!"
"@

$existingWebVm = gcloud compute instances list --filter="name=inventory-web-app" --format="value(name)"
if (-not $existingWebVm) {
    $WebStartupFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $WebStartupFile -Value $WebStartup -NoNewline
    gcloud compute instances create "inventory-web-app" `
        --zone="$Zone" `
        --machine-type="$MachineType" `
        --network="$NetworkName" `
        --subnet="$SubnetName" `
        --address="$WebStaticIp" `
        --tags=inventory-web `
        --image-family=ubuntu-2204-lts `
        --image-project=ubuntu-os-cloud `
        --boot-disk-size=20GB `
        --metadata-from-file=startup-script="$WebStartupFile"
    Remove-Item $WebStartupFile -Force
} else {
    Write-Host "Web VM inventory-web-app already exists." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  🎉 DEPLOYMENT TO GCP COMPLETE!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Application URL       : http://$WebStaticIp/" -ForegroundColor White
Write-Host "  Web Public Static IP  : $WebStaticIp" -ForegroundColor White
Write-Host "  Database Internal IP  : $DbInternalIp" -ForegroundColor White
Write-Host "  SSH Web Instance      : gcloud compute ssh inventory-web-app --zone=$Zone" -ForegroundColor Yellow
Write-Host "  SSH DB Instance       : gcloud compute ssh inventory-db --zone=$Zone" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  👉 Microsoft Entra ID (Azure AD) Redirect URI:" -ForegroundColor Cyan
Write-Host "     http://$WebStaticIp/" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green
