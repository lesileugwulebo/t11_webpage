# Manual Google Cloud Platform (GCP) Deployment Guide (Console UI Walkthrough)

This guide provides a complete, click-by-click manual walkthrough for deploying the **Verdad Solution InventoryApp** (with **Node.js/Express backend**, **MySQL database**, **Microsoft Entra ID SSO**, and the **IT Helpdesk & Requisition Ticketing System**) using only the **Google Cloud Web Console** (no Terraform, no CLI scripts required).

---

## 🏗️ Architecture Overview

```
                      +-------------------------------------------------------------+
                      |                 Microsoft Entra ID (Azure)                  |
                      |  - App Registration (Client ID & Tenant ID)                 |
                      |  - Redirect URI: http://<GCP-STATIC-EXTERNAL-IP>/           |
                      +------------------------------+------------------------------+
                                                     | (OIDC / OAuth 2.0 PKCE)
                                                     v
+----------------------------------------------------+-----------------------------------------------------+
|                                      Google Cloud Platform (VPC)                                         |
|                                                                                                          |
|  +------------------------------------------------+    +----------------------------------------------+  |
|  |       VM 1: Web & Node.js Backend              |    |           VM 2: MySQL Database               |  |
|  |  - Name: inventory-web-app                     |    |  - Name: inventory-db                        |  |
|  |  - Static External IP (Port 80/443/22)         |    |  - Internal IP: e.g. 10.128.0.2              |  |
|  |  - Nginx Reverse Proxy (Port 80 -> 5000)       |===>|  - MySQL 8.0 Server (Port 3306)              |  |
|  |  - Node.js Backend (Express on Port 5000)      |    |  - Database: inventory_db                    |  |
|  |  - Systemd Service: inventory-app.service      |    |  - Firewall Tag: inventory-db                |  |
|  |  - Firewall Tag: inventory-web                 |    |                                              |  |
|  +------------------------------------------------+    +----------------------------------------------+  |
+----------------------------------------------------------------------------------------------------------+
```

---

## Part 1: GCP Web Console - Network & Firewall Setup

### Step 1.1: Create Web Inbound Firewall Rule
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. In the navigation menu (top-left ☰), go to **VPC network** > **Firewall**.
3. Click **+ CREATE FIREWALL RULE** at the top.
4. Fill in the form:
   - **Name**: `allow-inventory-web`
   - **Network**: `default`
   - **Direction of traffic**: `Ingress`
   - **Action on match**: `Allow`
   - **Targets**: Select `Specified target tags`
   - **Target tags**: `inventory-web`
   - **Source filter**: `IPv4 ranges`
   - **Source IPv4 ranges**: `0.0.0.0/0`
   - **Protocols and ports**:
     - Check **Specified protocols and ports**
     - Check **TCP** and enter: `80, 443, 22`
5. Click **CREATE**.

---

### Step 1.2: Create Internal Database Firewall Rule
1. On the Firewall page, click **+ CREATE FIREWALL RULE**.
2. Fill in the form:
   - **Name**: `allow-inventory-internal-db`
   - **Network**: `default`
   - **Direction of traffic**: `Ingress`
   - **Action on match**: `Allow`
   - **Targets**: Select `Specified target tags`
   - **Target tags**: `inventory-db`
   - **Source filter**: `Source tags`
   - **Source tags**: `inventory-web`
   - **Protocols and ports**:
     - Check **Specified protocols and ports**
     - Check **TCP** and enter: `3306, 22`
3. Click **CREATE**.

---

### Step 1.3: Reserve a Static External IP Address
1. In the navigation menu, go to **VPC network** > **IP addresses**.
2. Click **RESERVE EXTERNAL STATIC IP ADDRESS**.
3. Fill in:
   - **Name**: `inventory-web-static-ip`
   - **Network Service Tier**: `Standard` (or `Premium`)
   - **IP version**: `IPv4`
   - **Type**: `Regional`
   - **Region**: Choose your desired region (e.g. `europe-west1` or `us-central1`).
4. Click **RESERVE**.
5. Copy the assigned IP address (e.g. `34.78.112.55`).

> [!IMPORTANT]
> Keep this IP handy: you will assign it to your Web VM and add it to your Microsoft Entra ID Redirect URIs.

---

## Part 2: GCP Web Console - Launch Compute Engine Virtual Machines

### Step 2.1: Launch Database VM (`inventory-db`)
1. In the navigation menu, go to **Compute Engine** > **VM instances**.
2. Click **CREATE INSTANCE**.
3. Configure the VM:
   - **Name**: `inventory-db`
   - **Region & Zone**: Same region as your Static IP (e.g. `europe-west1-b`).
   - **Machine configuration**: `General-purpose` > `E2` > `e2-micro` (or `e2-small`).
   - **Boot disk**: Click **CHANGE** > Select **Ubuntu** > Version **Ubuntu 22.04 LTS** (x86/64, 20 GB) > Click **SELECT**.
   - **Networking / Advanced options**:
     - Expand **Advanced options** > Expand **Networking**.
     - In **Network tags**, type: `inventory-db` and press Enter.
4. Click **CREATE**.

---

### Step 2.2: Launch Web & Application VM (`inventory-web-app`)
1. On the **VM instances** page, click **CREATE INSTANCE**.
2. Configure the VM:
   - **Name**: `inventory-web-app`
   - **Region & Zone**: Same region (e.g. `europe-west1-b`).
   - **Machine configuration**: `e2-micro` (or `e2-small`).
   - **Boot disk**: **Ubuntu 22.04 LTS** (20 GB).
   - **Firewall**: Check **Allow HTTP traffic** and **Allow HTTPS traffic**.
   - **Networking / Advanced options**:
     - Expand **Advanced options** > Expand **Networking**.
     - In **Network tags**, type: `inventory-web` and press Enter.
     - Expand **Network interfaces** > Click on `default`.
     - In **External IPv4 address**, select `inventory-web-static-ip` (the static IP reserved earlier).
3. Click **CREATE**.

---

## Part 3: Configure Database VM via GCP In-Browser SSH

1. On the **VM instances** list, find `inventory-db` and click the **SSH** button to open the terminal.
2. Note your Internal IP (e.g. `10.128.0.2`):
   ```bash
   hostname -I | awk '{print $1}'
   ```

3. **Install MySQL 8.0**:
   ```bash
   sudo apt update && sudo apt install -y mysql-server git
   ```

4. **Bind MySQL to Private VPC Network**:
   ```bash
   sudo sed -i 's/127.0.0.1/0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
   sudo systemctl restart mysql
   sudo systemctl enable mysql
   ```

5. **Create Database, Application User & Privileges**:
   ```bash
   sudo mysql -u root << 'EOF'
   CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'inventory_app'@'10.%' IDENTIFIED BY 'StrongGcpPass2026!';
   GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_app'@'10.%';
   FLUSH PRIVILEGES;
   EOF
   ```

6. **Import Schema & Seed Data**:
   ```bash
   git clone https://github.com/lesileugwulebo/t11_webpage.git /tmp/miva_project
   sudo mysql -u root inventory_db < /tmp/miva_project/backend/schema.sql
   rm -rf /tmp/miva_project
   echo "MySQL Database Ready on GCP!"
   ```
7. Close this SSH window.

---

## Part 4: Configure Web & Node.js Server via GCP In-Browser SSH

1. On the **VM instances** list, find `inventory-web-app` and click the **SSH** button.

2. **Install Node.js 20, NPM, Git, and Nginx**:
   ```bash
   sudo apt update && sudo apt install -y curl git nginx
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **Clone Application Repository**:
   ```bash
   sudo mkdir -p /var/www/inventory-app
   sudo chown -R $USER:$USER /var/www/inventory-app
   git clone https://github.com/lesileugwulebo/t11_webpage.git /var/www/inventory-app
   cd /var/www/inventory-app
   ```

4. **Install Node.js Backend Dependencies**:
   ```bash
   cd /var/www/inventory-app/backend/node_backend
   npm install --production
   cd /var/www/inventory-app
   ```

5. **Create Environment Configuration (`.env`)**:
   *(Replace `10.128.0.2` with the actual Internal IP of `inventory-db`)*
   ```bash
   cat << 'EOF' > /var/www/inventory-app/backend/node_backend/.env
   PORT=5000
   NODE_ENV=production
   DB_HOST=10.128.0.2
   DB_PORT=3306
   DB_USER=inventory_app
   DB_PASS=StrongGcpPass2026!
   DB_NAME=inventory_db
   JWT_SECRET=production_super_secret_gcp_jwt_key_2026
   EOF
   ```

6. **Configure Systemd Background Service**:
   ```bash
   sudo bash -c 'cat << "EOF" > /etc/systemd/system/inventory-app.service
   [Unit]
   Description=Verdad Solution InventoryApp Node.js Backend
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/var/www/inventory-app/backend/node_backend
   ExecStart=/usr/bin/node /var/www/inventory-app/backend/node_backend/server.js
   Restart=always
   RestartSec=5
   EnvironmentFile=/var/www/inventory-app/backend/node_backend/.env
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   EOF'

   sudo systemctl daemon-reload
   sudo systemctl enable --now inventory-app
   sudo systemctl status inventory-app --no-pager
   ```

7. **Configure Nginx Web Server & Reverse Proxy**:
   ```bash
   sudo bash -c 'cat << "EOF" > /etc/nginx/sites-available/inventory-app
   server {
       listen 80 default_server;
       server_name _;

       root /var/www/inventory-app/frontend;
       index index.html;

       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header Referrer-Policy "strict-origin-when-cross-origin" always;

       # Static Frontend SPA
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Reverse Proxy to Node.js Backend API
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

## Part 5: Microsoft Entra ID (Azure AD) Portal Configuration

1. Log into the [Microsoft Entra Admin Center](https://entra.microsoft.com/) or [Azure Portal](https://portal.azure.com/).
2. Go to **Identity** > **Applications** > **App registrations** > Select **Verdad Solution InventoryApp**.
3. Under **Authentication** > **Redirect URIs (Single-page application)**:
   - Add: `http://<GCP-STATIC-EXTERNAL-IP>/` (e.g. `http://34.78.112.55/`)
4. In `frontend/js/entraAuth.js`, ensure your Azure `clientId` and `authority` are set:
   ```javascript
   const entraConfig = {
     auth: {
       clientId: 'YOUR_AZURE_CLIENT_ID_HERE',
       authority: 'https://login.microsoftonline.com/YOUR_AZURE_TENANT_ID_HERE',
       redirectUri: window.location.origin + '/'
     }
   };
   ```

---

## 🧪 Part 6: Verification & Live Testing

1. **Run Automated Test Suite in GCP SSH**:
   ```bash
   cd /var/www/inventory-app
   bash test_linux.sh
   ```
   *Expected: All 13 tests pass successfully.*

2. **Open Application in Web Browser**:
   - Navigate to `http://<GCP-STATIC-EXTERNAL-IP>/`.
   - Log in using **Demo Credentials** (`admin` / `admin123` or `user` / `user123`) or click **"Sign in with Microsoft Entra ID"**.
   - Submit hardware requisitions under **"🎫 My Requests & Tickets"**.
   - Approve tickets under **"🎫 Helpdesk & Stock Approvals"** to verify automatic stock deduction from the MySQL database.
