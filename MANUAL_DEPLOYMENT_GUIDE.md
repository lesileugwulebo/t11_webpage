# 🖥️ Complete Manual Linux Deployment Walkthrough
### (No AWS • No Docker • No Terraform • 100% Pure Linux Commands)

This guide walks you through the manual deployment of **Verdad Solution InventoryApp** on standard Linux servers (Bare Metal, VPS like DigitalOcean/Linode/Hetzner, or Local VMs like VirtualBox/VMware/Proxmox).

---

# 📑 Table of Contents
1. [Architecture: 2-Server Setup (Recommended)](#-part-1-two-server-deployment-server-a--server-b)
2. [Server B: Dedicated MySQL Database Server Setup](#-step-by-step-server-b-database-server)
3. [Server A: Web Application & Nginx Server Setup](#-step-by-step-server-a-web--nginx-server)
4. [Alternative: Single Server (All-in-One) Setup](#-part-2-single-server-all-in-one-deployment)
5. [Verification & Maintenance Commands](#-verification--troubleshooting)

---

# 🌐 Part 1: Two-Server Deployment (Server A + Server B)

### Server Plan:
- **Server A (`192.168.1.10` or Public IP)**: Runs **Nginx** (Port 80/443) + **Application Server** (Port 5000).
- **Server B (`192.168.1.20` or Private IP)**: Runs **MySQL Database 8.0** (Port 3306).

---

## 🗄️ Step-by-Step: Server B (Database Server)

Log in to **Server B** via SSH:
```bash
ssh user@192.168.1.20
```

### 1. Install MySQL Server
```bash
# Update repositories and install MySQL
sudo apt update
sudo apt install -y mysql-server curl git ufw

# Enable and start MySQL service
sudo systemctl enable --now mysql
```

### 2. Configure MySQL to Listen on Network Interface
By default, MySQL only listens on `127.0.0.1` (localhost). We must tell it to listen to requests from the network:

1. Open the MySQL configuration file:
   ```bash
   sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
   ```
2. Find the line starting with `bind-address` and change it to `0.0.0.0`:
   ```ini
   bind-address = 0.0.0.0
   ```
3. Save and close the file (`Ctrl + O`, then `Enter`, then `Ctrl + X`).
4. Restart MySQL to apply the changes:
   ```bash
   sudo systemctl restart mysql
   ```

### 3. Create the Database and Remote User
1. Log in to the MySQL root shell:
   ```bash
   sudo mysql
   ```
2. Run the following SQL commands (replace `192.168.1.10` with **Server A's IP address**):
   ```sql
   -- 1. Create Database
   CREATE DATABASE IF NOT EXISTS `inventory_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

   -- 2. Create User allowing connection FROM Server A's IP
   CREATE USER 'inventory_user'@'192.168.1.10' IDENTIFIED WITH mysql_native_password BY 'inventory_pass_123';

   -- 3. Grant privileges on inventory_db to this user
   GRANT ALL PRIVILEGES ON `inventory_db`.* TO 'inventory_user'@'192.168.1.10';

   -- 4. Also allow localhost connection for local debugging
   CREATE USER 'inventory_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'inventory_pass_123';
   GRANT ALL PRIVILEGES ON `inventory_db`.* TO 'inventory_user'@'localhost';

   -- 5. Apply changes
   FLUSH PRIVILEGES;
   EXIT;
   ```

### 4. Import the Database Tables & Seed Data
Download and import `backend/schema.sql` into MySQL:
```bash
# Download schema file
curl -sSL https://raw.githubusercontent.com/lesileugwulebo/t11_webpage/main/backend/schema.sql -o /tmp/schema.sql

# Import into inventory_db
sudo mysql inventory_db < /tmp/schema.sql

# Verify the imported tables
sudo mysql -e "USE inventory_db; SHOW TABLES;"
```

### 5. Configure Firewall on Server B
If you have `ufw` enabled on Server B, allow incoming traffic on port 3306 **only from Server A**:
```bash
sudo ufw allow from 192.168.1.10 to any port 3306 proto tcp comment "Allow MySQL from Server A"
```

✅ **Server B is now completely ready!**

---

## 🌐 Step-by-Step: Server A (Web & Nginx Server)

Log in to **Server A** via SSH:
```bash
ssh user@192.168.1.10
```

### 1. Install Required Packages
```bash
sudo apt update
sudo apt install -y nginx python3 python3-pip nodejs npm curl git mysql-client ufw
```

### 2. Test Remote Database Connection from Server A to Server B
Before deploying the code, test that Server A can reach MySQL on Server B:
```bash
mysql -h 192.168.1.20 -u inventory_user -pinventory_pass_123 -e "USE inventory_db; SELECT name, sku, unit_price, quantity FROM inventory_items LIMIT 3;"
```
*(If this prints the seed items, your database networking is 100% operational!)*

### 3. Clone the Project Codebase
```bash
git clone https://github.com/lesileugwulebo/t11_webpage.git /home/$USER/verdad_inventory
cd /home/$USER/verdad_inventory
```

### 4. Create Production Environment Configuration (`.env`)
Create the `.env` file pointing to **Server B's IP**:
```bash
mkdir -p backend/node_backend

cat > backend/node_backend/.env << 'EOF'
PORT=5000
NODE_ENV=production

# Remote MySQL Server B IP
DB_HOST=192.168.1.20
DB_USER=inventory_user
DB_PASSWORD=inventory_pass_123
DB_NAME=inventory_db
DB_PORT=3306

# JWT Authentication Secret
JWT_SECRET=verdad_solution_inventory_super_secret_jwt_key_2026
EOF
```

### 5. Create Systemd Service for 24/7 Background Execution
Create `/etc/systemd/system/verdad-inventory.service`:
```bash
sudo nano /etc/systemd/system/verdad-inventory.service
```

Paste the following content (replace `ubuntu` with your username and update the path if different):
```ini
[Unit]
Description=Verdad Solution InventoryApp Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/verdad_inventory
ExecStart=/usr/bin/python3 /home/ubuntu/verdad_inventory/server.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
```

Enable and start the background service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable verdad-inventory
sudo systemctl start verdad-inventory

# Check that service is running:
sudo systemctl status verdad-inventory
```

### 6. Configure Nginx Web Server (Reverse Proxy)
1. Create the Nginx site configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/verdad-inventory
   ```

2. Paste the following configuration:
   ```nginx
   server {
       listen 80;
       server_name _;

       # Enable Gzip Compression
       gzip on;
       gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

       # Reverse Proxy all incoming requests to the App on port 5000
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

3. Enable the configuration and restart Nginx:
   ```bash
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo ln -sf /etc/nginx/sites-available/verdad-inventory /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. Configure Firewall on Server A:
   ```bash
   sudo ufw allow 80/tcp comment "HTTP"
   sudo ufw allow 443/tcp comment "HTTPS"
   sudo ufw allow 22/tcp comment "SSH"
   sudo ufw --force enable
   ```

---

# 📦 Part 2: Single-Server (All-in-One) Deployment

If you only have **one single Linux server** and want both MySQL and Nginx/Application on the same machine:

```bash
# 1. Clone repository
git clone https://github.com/lesileugwulebo/t11_webpage.git ~/verdad_inventory
cd ~/verdad_inventory

# 2. Make scripts executable
chmod +x setup_linux_native.sh start_server.sh test_linux.sh

# 3. Run the automated native installer
sudo ./setup_linux_native.sh
```
*This installs MySQL, creates the database locally, configures the `.env`, registers the Systemd service, and starts the server on port 5000.*

---

# 🧪 Verification & Troubleshooting

### 1. Test Application from Terminal
Run the built-in automated test suite:
```bash
cd ~/verdad_inventory
./test_linux.sh
```

### 2. View Real-Time Application Logs
```bash
# View live application logs
sudo journalctl -u verdad-inventory -f

# View Nginx access logs
sudo tail -f /var/log/nginx/access.log

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### 3. Useful Management Commands
| Action | Command |
| :--- | :--- |
| **Restart App** | `sudo systemctl restart verdad-inventory` |
| **Stop App** | `sudo systemctl stop verdad-inventory` |
| **Check App Status** | `sudo systemctl status verdad-inventory` |
| **Restart MySQL** | `sudo systemctl restart mysql` |
| **Restart Nginx** | `sudo systemctl reload nginx` |

---

# 🔐 Default Demo Accounts

- **Administrator Portal**: `admin` / `admin123`
- **Staff Portal**: `user` / `user123`
- **Currency**: Nigerian Naira (**₦**)
