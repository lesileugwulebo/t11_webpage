# 🐧 Complete Native Linux Deployment Walkthrough (No Docker)

This guide provides a comprehensive step-by-step walkthrough to deploy **Verdad Solution InventoryApp** directly onto a Linux machine (Ubuntu, Debian, CentOS, RHEL, Rocky Linux, or Fedora) with a native **MySQL Database Server** and a **Systemd background service**.

---

## ⚡ Option A: Automated 1-Command Native Installer

If you want the script to automatically install MySQL, create the database, import the tables, configure permissions, and start the system service for you:

```bash
# 1. Clone the repository
git clone https://github.com/lesileugwulebo/t11_webpage.git
cd t11_webpage

# 2. Make executable and run the native installer with sudo
chmod +x setup_linux_native.sh start_server.sh test_linux.sh
sudo ./setup_linux_native.sh
```

---

## 🛠️ Option B: Manual Step-by-Step Walkthrough

If you prefer to perform each step manually, follow the 6 steps below:

### Step 1: Install System Packages & MySQL Server

#### On Ubuntu / Debian:
```bash
sudo apt update
sudo apt install -y mysql-server python3 python3-pip nodejs npm curl git
sudo systemctl enable --now mysql
```

#### On CentOS / RHEL / Rocky Linux:
```bash
sudo dnf install -y mysql-server python3 python3-pip nodejs npm curl git
sudo systemctl enable --now mysqld
```

---

### Step 2: Create MySQL Database, User & Import Schema

1. **Log in to MySQL as root**:
   ```bash
   sudo mysql
   ```

2. **Create the Database and Dedicated User**:
   ```sql
   CREATE DATABASE IF NOT EXISTS `inventory_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'inventory_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'inventory_pass_123';
   GRANT ALL PRIVILEGES ON `inventory_db`.* TO 'inventory_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

3. **Import Database Tables & Seed Catalog**:
   From your project directory, run:
   ```bash
   mysql -u inventory_user -pinventory_pass_123 inventory_db < backend/schema.sql
   ```

4. **Verify Database Import**:
   ```bash
   mysql -u inventory_user -pinventory_pass_123 -e "USE inventory_db; SHOW TABLES; SELECT name, sku, unit_price, quantity FROM inventory_items LIMIT 5;"
   ```

---

### Step 3: Configure Environment Variables

Create the `.env` configuration file in `backend/node_backend/.env`:

```bash
cat > backend/node_backend/.env << 'EOF'
PORT=5000
NODE_ENV=production

# MySQL Database Settings
DB_HOST=localhost
DB_USER=inventory_user
DB_PASSWORD=inventory_pass_123
DB_NAME=inventory_db
DB_PORT=3306

# Authentication Secret
JWT_SECRET=verdad_solution_inventory_super_secret_jwt_key_2026
EOF
```

---

### Step 4: Install Application Dependencies & Test Run

1. **Install Node.js packages** (if running the Express backend):
   ```bash
   cd backend/node_backend
   npm install --production
   cd ../..
   ```

2. **Make scripts executable**:
   ```bash
   chmod +x start_server.sh test_linux.sh
   ```

3. **Start the application**:
   ```bash
   ./start_server.sh
   ```
   Access the app in your browser at `http://<YOUR_SERVER_IP>:5000`.

---

### Step 5: Configure 24/7 Background Service (Systemd)

To ensure the app stays running after terminal close and automatically starts upon server reboots:

1. **Create the Systemd unit file**:
   ```bash
   sudo nano /etc/systemd/system/verdad-inventory.service
   ```

2. **Paste the following configuration** (adjust `/home/ubuntu/t11_webpage` and user if different):
   ```ini
   [Unit]
   Description=Verdad Solution InventoryApp Daemon
   After=network.target mysql.service

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/home/ubuntu/t11_webpage
   ExecStart=/usr/bin/python3 /home/ubuntu/t11_webpage/server.py
   Restart=always
   RestartSec=5
   StandardOutput=journal
   StandardError=journal
   Environment=PYTHONUNBUFFERED=1
   Environment=PORT=5000

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable verdad-inventory
   sudo systemctl start verdad-inventory
   ```

4. **Useful Service Management Commands**:
   ```bash
   # Check service status
   sudo systemctl status verdad-inventory

   # View live application logs
   sudo journalctl -u verdad-inventory -f

   # Restart application
   sudo systemctl restart verdad-inventory

   # Stop application
   sudo systemctl stop verdad-inventory
   ```

---

### Step 6: Configure Nginx Reverse Proxy (Optional, Port 80/443)

To serve the app on standard port `80` with domain name support:

1. **Install Nginx**:
   ```bash
   sudo apt install -y nginx
   ```

2. **Configure Nginx site**:
   ```bash
   sudo nano /etc/nginx/sites-available/verdad-inventory.conf
   ```

   Paste:
   ```nginx
   server {
       listen 80;
       server_name your-server-ip-or-domain;

       gzip on;
       gzip_types text/plain text/css application/json application/javascript;

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
   ```

3. **Enable site & reload Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/verdad-inventory.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Allow port in firewall (`ufw`)**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 5000/tcp
   ```

---

## 🧪 Automated Testing on Linux

Run the built-in Linux test suite to verify all API endpoints and stock operations:

```bash
./test_linux.sh
```

---

## 🔐 Default Demo Accounts

| Role | Username | Password | Features |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full stock oversight, User creation, System audit logs |
| **Staff Member** | `user` | `user123` | "Today's Work" timeline, Add/Adjust stock in Naira (₦) |
