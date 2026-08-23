# Google Cloud Platform (GCP) Deployment Guide

This guide details how to deploy the **Verdad Solution InventoryApp** (with **Microsoft Entra ID SSO**, **Node.js/Python backend**, and the **IT Helpdesk & Requisition Ticketing System**) onto **Google Cloud Platform (GCP)**.

---

## 🏛️ GCP Architecture Options

You have two primary production architectures on GCP:

```
===================================================================================================
OPTION A: 2-Tier Compute Engine (VMs)                 OPTION B: Serverless (Cloud Run + Cloud SQL)
===================================================================================================

       [ Microsoft Entra ID ]                               [ Microsoft Entra ID ]
                 │                                                    │
                 ▼                                                    ▼
       ┌──────────────────┐                                 ┌──────────────────┐
       │   GCP Cloud IP   │                                 │ HTTPS Cloud Run  │
       └─────────┬────────┘                                 │  Container App   │
                 │                                          └─────────┬────────┘
       ┌─────────▼────────┐                                           │ (Cloud SQL Auth Proxy)
       │  Compute Engine  │                                           ▼
       │   Web/App VM     │                                 ┌──────────────────┐
       │ (Nginx + Node/Py)│                                 │    Cloud SQL     │
       └─────────┬────────┘                                 │ (MySQL 8 Managed)│
                 │ (Private VPC 3306)                       └──────────────────┘
       ┌─────────▼────────┐
       │  Compute Engine  │
       │   Database VM    │
       │   (MySQL 8.0)    │
       └──────────────────┘
```

---

## 🚀 Option A: 2-Tier Compute Engine (Virtual Machines)

### Step 1: GCP VPC & Firewall Rules

Open **Google Cloud Shell** or your local terminal with `gcloud` CLI initialized:

```bash
# 1. Set your GCP Project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-west1"
export ZONE="europe-west1-b"

gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION
gcloud config set compute/zone $ZONE

# 2. Allow Public HTTP (80), HTTPS (443), and SSH (22) to Web VM
gcloud compute firewall-rules create allow-inventory-web \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443,tcp:22 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=inventory-web

# 3. Allow Internal MySQL (3306) strictly between Web VM and DB VM
gcloud compute firewall-rules create allow-inventory-internal-db \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:3306 \
    --source-tags=inventory-web \
    --target-tags=inventory-db
```

---

### Step 2: Reserve a Static External IP & Launch Compute Engine VMs

```bash
# 1. Reserve Static IP for the Web Tier
gcloud compute addresses create inventory-web-ip --region=$REGION
export WEB_STATIC_IP=$(gcloud compute addresses describe inventory-web-ip --region=$REGION --format="value(address)")
echo "Static External IP for Web VM: $WEB_STATIC_IP"

# 2. Create Database VM (Ubuntu 22.04 LTS)
gcloud compute instances create inventory-db \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=inventory-db \
    --boot-disk-size=20GB

# 3. Create Web & App VM (Ubuntu 22.04 LTS with Static IP)
gcloud compute instances create inventory-web-app \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --address=$WEB_STATIC_IP \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=inventory-web \
    --boot-disk-size=20GB
```

---

### Step 3: Configure Database VM (`inventory-db`)

SSH into the Database VM:
```bash
gcloud compute ssh inventory-db --zone=$ZONE
```

Run inside `inventory-db`:
```bash
# 1. Install MySQL Server
sudo apt update && sudo apt install -y mysql-server git

# 2. Bind MySQL to internal network (0.0.0.0)
sudo sed -i 's/127.0.0.1/0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql
sudo systemctl enable mysql

# 3. Create Database & Application User (Replace 10.128.%.% with your GCP subnet)
sudo mysql -u root << 'EOF'
CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'inventory_app'@'10.%' IDENTIFIED BY 'StrongGcpPass2026!';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_app'@'10.%';
FLUSH PRIVILEGES;
EOF

# 4. Clone and Import Schema
git clone https://github.com/lesileugwulebo/t11_webpage.git /tmp/miva_project
sudo mysql -u root inventory_db < /tmp/miva_project/backend/schema.sql
rm -rf /tmp/miva_project

# Note the internal IP
hostname -I | awk '{print $1}'
```
Exit SSH: `exit`

---

### Step 4: Configure Web & Application VM (`inventory-web-app`)

SSH into the Web & App VM:
```bash
gcloud compute ssh inventory-web-app --zone=$ZONE
```

Run inside `inventory-web-app`:
```bash
# 1. Install Node.js, Python3, and Nginx
sudo apt update && sudo apt install -y git python3 python3-pip nodejs npm nginx

# 2. Clone Repository
sudo mkdir -p /var/www/inventory-app
sudo chown -R $USER:$USER /var/www/inventory-app
git clone https://github.com/lesileugwulebo/t11_webpage.git /var/www/inventory-app
cd /var/www/inventory-app

# 3. Install Node.js Backend Dependencies (If using Node.js)
cd /var/www/inventory-app/backend/node_backend
npm install --production
cd /var/www/inventory-app

# 4. Configure Environment (.env)
cat << 'EOF' > /var/www/inventory-app/.env
PORT=5000
NODE_ENV=production
DB_HOST=INVENTORY_DB_INTERNAL_IP_HERE
DB_PORT=3306
DB_USER=inventory_app
DB_PASS=StrongGcpPass2026!
DB_NAME=inventory_db
JWT_SECRET=super_secret_gcp_production_jwt_key_2026
EOF

# 5. Create Systemd Service for Node.js backend (or Python server)
sudo bash -c 'cat << "EOF" > /etc/systemd/system/inventory-app.service
[Unit]
Description=Verdad Solution InventoryApp Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/inventory-app/backend/node_backend
ExecStart=/usr/bin/node /var/www/inventory-app/backend/node_backend/server.js
Restart=always
RestartSec=5
EnvironmentFile=/var/www/inventory-app/.env

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable --now inventory-app

# 6. Configure Nginx Reverse Proxy
sudo bash -c 'cat << "EOF" > /etc/nginx/sites-available/inventory-app
server {
    listen 80 default_server;
    server_name _;

    root /var/www/inventory-app/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF'

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## ⚡ Option B: Serverless on GCP (Cloud Run + Cloud SQL)

For high-availability, autoscaling from 0 to 1000+ instances, and zero server maintenance:

### Step 1: Provision Managed Cloud SQL (MySQL 8.0)
```bash
# Create Cloud SQL Instance
gcloud sql instances create inventory-mysql \
    --database-version=MYSQL_8_0 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password="StrongRootPassword2026!"

# Create database and user
gcloud sql databases create inventory_db --instance=inventory-mysql
gcloud sql users create inventory_app \
    --instance=inventory-mysql \
    --password="StrongCloudSqlPass2026!"

# Import initial schema
gcloud sql import sql inventory-mysql gs://YOUR_BUCKET/schema.sql --database=inventory_db
```

### Step 2: Deploy to Cloud Run
```bash
# Build and deploy container directly from source
gcloud run deploy inventory-app \
    --source . \
    --region=$REGION \
    --allow-unauthenticated \
    --port=5000 \
    --add-cloudsql-instances=$PROJECT_ID:$REGION:inventory-mysql \
    --set-env-vars "NODE_ENV=production,DB_USER=inventory_app,DB_PASS=StrongCloudSqlPass2026!,DB_NAME=inventory_db,DB_HOST=/cloudsql/$PROJECT_ID:$REGION:inventory-mysql,JWT_SECRET=super_secret_gcp_production_jwt_key_2026"
```

---

## 🔑 Microsoft Entra ID (Azure AD) Configuration for GCP

1. In **Microsoft Entra Admin Center** > **App registrations** > Select **Verdad Solution InventoryApp**.
2. Under **Authentication** > **Redirect URIs (Single-page application)**:
   - Add your GCP Static IP: `http://<GCP_WEB_STATIC_IP>/`
   - (Or Cloud Run URL: `https://inventory-app-xxxx-ew.a.run.app/`)
3. Update `frontend/js/entraAuth.js` with your Azure `clientId` and `authority`:
   ```javascript
   const entraConfig = {
     auth: {
       clientId: 'YOUR_AZURE_CLIENT_ID',
       authority: 'https://login.microsoftonline.com/YOUR_AZURE_TENANT_ID',
       redirectUri: window.location.origin + '/'
     }
   };
   ```

---

## 🧪 Verification on GCP

Run the 13-point test suite on the GCP Web VM:
```bash
cd /var/www/inventory-app
bash test_linux.sh
```

**Expected Result:**
```
======================================================
  Verdad Solution InventoryApp - Linux Test Suite
======================================================
1. Health Check Endpoint (/api/health) ... PASSED
2. Standard User Authentication ... PASSED
3. Administrator Authentication ... PASSED
4. Inventory List & Stock Fetch ... PASSED (9 products found)
5. Inventory Metrics & Valuation ... PASSED (Total Valuation: ₦72,675,320.00)
6. Testing Product Creation ... PASSED
7. Testing Restock Operation ... PASSED
8. Testing 'Today Work' Activity Tracking ... PASSED
9. Testing Admin User Provisioning ... PASSED
10. Testing Stock Deletion & Audit Log ... PASSED
11. Testing Microsoft Entra ID SSO (/api/auth/entra-sso) ... PASSED
12. Testing Support & Requisition Ticket Creation ... PASSED
13. Testing Admin Ticket Approval & Dispatch ... PASSED

======================================================
  🎉 ALL 13 LINUX VERIFICATION TESTS PASSED!          
======================================================
```
