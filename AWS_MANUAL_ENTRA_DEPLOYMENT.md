# Manual AWS Deployment Guide with Microsoft Entra ID (Azure AD) SSO (No Terraform)

This guide provides a comprehensive, production-ready walkthrough for deploying **Verdad Solution InventoryApp** with **Microsoft Entra ID (Azure AD) Single Sign-On** and the **IT Helpdesk & Requisition Ticketing System** onto a 2-Tier AWS EC2 infrastructure using only the **AWS Management Console** and **Azure Portal** (pure manual configuration, no Terraform required).

---

## 🏗️ Architecture Overview

```
                      +-------------------------------------------------------------+
                      |                 Microsoft Entra ID (Azure)                  |
                      |  - App Registration (Client ID & Tenant ID)                 |
                      |  - Redirect URI: http://<EC2-PUBLIC-IP>/ or HTTPS Domain   |
                      |  - App Roles / Token Claims (Admin / Staff)                 |
                      +------------------------------+------------------------------+
                                                     | (OIDC / OAuth 2.0 PKCE)
                                                     v
+----------------------------------------------------+-----------------------------------------------------+
|                                              AWS Cloud (VPC)                                             |
|                                                                                                          |
|  +------------------------------------------------+    +----------------------------------------------+  |
|  |           EC2 Instance 1: Web & App            |    |          EC2 Instance 2: Database            |  |
|  |  - Public IP / Elastic IP (Port 80/443/22)     |    |  - Private IP (e.g., 172.31.32.45)           |  |
|  |  - Nginx Reverse Proxy & Static UI Engine      |    |  - MySQL 8.0 Server                          |  |
|  |  - Python / Node.js Backend API (Port 5000)    |===>|  - Database: inventory_db                    |  |
|  |  - Systemd Service: inventory-app.service      |    |  - Port 3306 (Restricted to EC2 #1 only)    |  |
|  +------------------------------------------------+    +----------------------------------------------+  |
+----------------------------------------------------------------------------------------------------------+
```

---

## Part 1: Microsoft Entra ID (Azure Portal) Configuration

### Step 1.1: Register the Application in Microsoft Entra Admin Center
1. Sign in to the [Microsoft Entra Admin Center](https://entra.microsoft.com/) or [Azure Portal](https://portal.azure.com/).
2. Navigate to **Identity** > **Applications** > **App registrations** > Click **+ New registration**.
3. Fill in the registration details:
   - **Name**: `Verdad Solution InventoryApp`
   - **Supported account types**: `Accounts in this organizational directory only (Single tenant)` (or Multitenant if required).
   - **Redirect URI**: Select platform **Single-page application (SPA)** and enter:
     - `http://<YOUR-EC2-ELASTIC-IP>/` (or `https://<YOUR-DOMAIN>/` if using a custom domain).
4. Click **Register**.

### Step 1.2: Capture Application & Directory IDs
On the application **Overview** page, copy the following values:
- **Application (client) ID**: e.g., `11111111-2222-3333-4444-555555555555`
- **Directory (tenant) ID**: e.g., `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`

### Step 1.3: Configure App Roles (Admin & Staff)
1. In the app registration menu, click **App roles** > Click **+ Create app role**.
2. Create **Admin Role**:
   - **Display name**: `Inventory Administrator`
   - **Allowed member types**: `Users/Groups`
   - **Value**: `Inventory.Admin`
   - **Description**: `Full administrative permissions for stock and user management`
3. Create **Staff Role**:
   - **Display name**: `Inventory Staff`
   - **Allowed member types**: `Users/Groups`
   - **Value**: `Inventory.User`
   - **Description**: `Standard warehouse staff and equipment request access`
4. Navigate to **Enterprise applications** > Select **Verdad Solution InventoryApp** > **Users and groups** > Click **+ Add user/group** and assign your test users to the respective roles.

### Step 1.4: Configure API Permissions
1. In the app registration, click **API permissions** > Click **+ Add a permission**.
2. Select **Microsoft Graph** > **Delegated permissions**.
3. Ensure the following permissions are checked:
   - `User.Read`
   - `openid`
   - `profile`
   - `email`
4. Click **Grant admin consent for <Your Tenant>**.

---

## Part 2: AWS Infrastructure Setup (AWS Console)

### Step 2.1: Create Security Groups

1. Open the [AWS EC2 Management Console](https://console.aws.amazon.com/ec2/).
2. Go to **Network & Security** > **Security Groups** > Click **Create security group**.

#### 1. Web & Application Security Group (`sg-inventory-web`)
- **Description**: `Inbound HTTP/HTTPS and SSH for Web Tier`
- **Inbound Rules**:
  | Type | Protocol | Port Range | Source | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | **HTTP** | TCP | `80` | `0.0.0.0/0` | Public Web traffic |
  | **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure SSL Web traffic |
  | **SSH** | TCP | `22` | `My IP` (or admin CIDR) | Secure Shell administration |

#### 2. Database Security Group (`sg-inventory-db`)
- **Description**: `Inbound MySQL access strictly from Web Tier`
- **Inbound Rules**:
  | Type | Protocol | Port Range | Source | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | **MYSQL/Aurora** | TCP | `3306` | Custom: `sg-inventory-web` | MySQL access from Web EC2 |
  | **SSH** | TCP | `22` | Custom: `sg-inventory-web` or `My IP` | Database administration |

---

### Step 2.2: Launch EC2 Instances

#### Instance 1: Database Server (`inventory-db-server`)
1. Click **Launch instances**.
2. **Name**: `inventory-db-server`
3. **AMI**: `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type` (64-bit x86)
4. **Instance type**: `t3.micro` (or `t3.small`)
5. **Key pair**: Select or create an SSH key pair (e.g. `inventory-aws-key.pem`).
6. **Network settings**:
   - Security Group: Select existing `sg-inventory-db`.
   - Auto-assign Public IP: `Enable` (or `Disable` if using private subnet + bastion).
7. Click **Launch instance**.
8. Note the **Private IPv4 address** (e.g. `172.31.25.110`).

#### Instance 2: Web & App Server (`inventory-web-server`)
1. Click **Launch instances**.
2. **Name**: `inventory-web-server`
3. **AMI**: `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`
4. **Instance type**: `t3.micro` (or `t3.small`)
5. **Key pair**: Select `inventory-aws-key.pem`.
6. **Network settings**:
   - Security Group: Select existing `sg-inventory-web`.
   - Auto-assign Public IP: `Enable`.
7. Click **Launch instance**.

#### Step 2.3: Allocate an Elastic IP for Web Server
1. Go to **Network & Security** > **Elastic IPs** > Click **Allocate Elastic IP address**.
2. Click **Allocate**.
3. Select the new Elastic IP > **Actions** > **Associate Elastic IP address**.
4. Choose **Instance**: `inventory-web-server` and click **Associate**.
5. Note the **Public IPv4 address** (e.g. `54.210.88.99`).

---

## Part 3: Database Server Configuration (EC2 #2)

SSH into the Database EC2 instance:
```bash
ssh -i inventory-aws-key.pem ubuntu@<DB-PUBLIC-IP>
```

### Step 3.1: Install and Secure MySQL 8.0
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y mysql-server

# Secure the installation
sudo mysql_secure_installation
```

### Step 3.2: Allow Remote MySQL Connections from Web EC2
Edit MySQL configuration:
```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```
Find the `bind-address` line and change it to `0.0.0.0`:
```ini
bind-address = 0.0.0.0
```
Save and restart MySQL:
```bash
sudo systemctl restart mysql
sudo systemctl enable mysql
```

### Step 3.3: Provision Database, User & Schema
Open MySQL console:
```bash
sudo mysql -u root -p
```
Run the following SQL commands:
```sql
-- 1. Create Database
CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Create Application User (Replace with your Web EC2 private IP or subnet e.g. 172.31.%.%)
CREATE USER 'inventory_app'@'172.31.%.%' IDENTIFIED BY 'StrongInventoryDbPass2026!';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_app'@'172.31.%.%';
FLUSH PRIVILEGES;

EXIT;
```

### Step 3.4: Import Database Schema and Seed Data
```bash
# Clone schema
git clone https://github.com/lesileugwulebo/t11_webpage.git /tmp/miva_project
sudo mysql -u root -p inventory_db < /tmp/miva_project/backend/schema.sql
rm -rf /tmp/miva_project

echo "Database successfully provisioned!"
```

---

## Part 4: Web & App Server Configuration (EC2 #1)

SSH into the Web & App EC2 instance:
```bash
ssh -i inventory-aws-key.pem ubuntu@<WEB-ELASTIC-IP>
```

### Step 4.1: Install System Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3 python3-pip python3-venv nginx curl ufw
```

### Step 4.2: Clone Project Repository
```bash
sudo mkdir -p /var/www/inventory-app
sudo chown -R ubuntu:ubuntu /var/www/inventory-app
git clone https://github.com/lesileugwulebo/t11_webpage.git /var/www/inventory-app
cd /var/www/inventory-app
```

### Step 4.3: Configure Microsoft Entra ID Credentials
Open `frontend/js/entraAuth.js` and insert your Azure App Registration IDs:
```bash
nano frontend/js/entraAuth.js
```
Update the `entraConfig` object:
```javascript
const entraConfig = {
  auth: {
    clientId: 'YOUR_AZURE_CLIENT_ID_HERE',        // e.g. 11111111-2222-3333-4444-555555555555
    authority: 'https://login.microsoftonline.com/YOUR_AZURE_TENANT_ID_HERE', // or /common
    redirectUri: window.location.origin + '/'
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  }
};
```

### Step 4.4: Configure Environment & Database Connection
Create `/var/www/inventory-app/.env`:
```bash
nano /var/www/inventory-app/.env
```
Add the following configuration (replace with your DB Private IP):
```env
PORT=5000
NODE_ENV=production
DB_HOST=172.31.25.110
DB_PORT=3306
DB_USER=inventory_app
DB_PASS=StrongInventoryDbPass2026!
DB_NAME=inventory_db
JWT_SECRET=production_super_secret_jwt_key_2026_verdad
AZURE_TENANT_ID=YOUR_AZURE_TENANT_ID_HERE
AZURE_CLIENT_ID=YOUR_AZURE_CLIENT_ID_HERE
```

### Step 4.5: Configure Backend Systemd Service
Create the systemd daemon:
```bash
sudo nano /etc/systemd/system/inventory-app.service
```
Insert the following configuration:
```ini
[Unit]
Description=Verdad Solution InventoryApp Python REST Daemon
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/inventory-app
ExecStart=/usr/bin/python3 /var/www/inventory-app/server.py
Restart=always
RestartSec=5
EnvironmentFile=/var/www/inventory-app/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the backend service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable inventory-app
sudo systemctl start inventory-app
sudo systemctl status inventory-app --no-pager
```

### Step 4.6: Configure Nginx Web Server & Reverse Proxy
Create the Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/inventory-app
```
Add the following server block:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/inventory-app/frontend;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend Single-Page App Static Assets
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy for Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static caching for JS and CSS
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Part 5: Verification & End-to-End Testing

### 5.1: Run Automated Verification Test on Web EC2
Execute the built-in 13-point test suite directly on the Web EC2 instance:
```bash
cd /var/www/inventory-app
bash test_linux.sh
```

**Expected Output:**
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

### 5.2: Test in Web Browser
1. Open your browser and navigate to `http://<WEB-ELASTIC-IP>/`.
2. Click **"Sign in with Microsoft Entra ID"**.
3. Sign in with your Microsoft 365 or Azure AD corporate credentials.
4. Verify you are automatically provisioned and redirected to the **Staff Workspace** or **Administrator Dashboard**.
5. Open the **"🎫 My Requests & Tickets"** tab, click **"+ Raise New Ticket"**, and submit an equipment request.
6. Switch to the Administrator view, open **"🎫 Helpdesk & Stock Approvals"**, and click **"✓ Approve"** to verify automatic stock deduction and audit ledger recording.

---

## Part 6: (Optional) SSL / HTTPS Setup with Let's Encrypt

If you point a domain name (e.g. `inventory.yourcompany.com`) to your Elastic IP:

1. Update the Redirect URI in Microsoft Entra Admin Center to `https://inventory.yourcompany.com/`.
2. Install Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d inventory.yourcompany.com
   ```
3. Test automatic certificate renewal:
   ```bash
   sudo certbot renew --dry-run
   ```

---

## 📋 Summary of Deployment Checklist

| Step | Action | Status |
| :--- | :--- | :--- |
| **1** | Azure App Registration & Roles (`Inventory.Admin`, `Inventory.User`) | Configured |
| **2** | Azure Redirect URI set to `http://<EC2-ELASTIC-IP>/` | Configured |
| **3** | AWS Security Groups (`sg-inventory-web` & `sg-inventory-db`) | Configured |
| **4** | EC2 #2 MySQL 8.0 installed & schema imported from `schema.sql` | Configured |
| **5** | EC2 #1 Nginx + Python server configured as systemd service | Configured |
| **6** | `frontend/js/entraAuth.js` populated with Client ID & Tenant ID | Configured |
| **7** | All 13 tests passed via `bash test_linux.sh` | Verified |
