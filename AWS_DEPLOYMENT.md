# ☁️ AWS 2-Tier EC2 Deployment Walkthrough - Verdad Solution InventoryApp

This walkthrough details the step-by-step deployment of **Verdad Solution InventoryApp** on Amazon Web Services (AWS) using a production **2-Tier Architecture**:
- **EC2 Instance 1 (`Web-App-Nginx`)**: Nginx Reverse Proxy (Port 80/443) + React & Node.js/Python Application Server (Port 5000).
- **EC2 Instance 2 (`Database-MySQL`)**: Dedicated MySQL 8.0 Database Server (Port 3306), isolated and accessible only via Private IP from Instance 1.

---

## 📐 Architecture Overview

```
[Internet Users]
       │
       ▼ (HTTP: 80 / HTTPS: 443)
┌────────────────────────────────────────────────────────┐
│  EC2 Instance 1 (Web & Application Server)             │
│  • Public IP: e.g. 54.210.xx.xx                        │
│  • Private IP: e.g. 10.0.1.50                          │
│  • Nginx Reverse Proxy (Port 80 -> Port 5000)          │
│  • Systemd Service 'verdad-inventory' (Port 5000)      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ (MySQL: 3306 on AWS VPC Private Network)
┌────────────────────────────────────────────────────────┐
│  EC2 Instance 2 (Dedicated Database Server)            │
│  • Private IP: e.g. 10.0.2.100                         │
│  • MySQL 8.0 Server (`inventory_db`)                   │
│  • Security Group: Allows Port 3306 ONLY from Web SG   │
└────────────────────────────────────────────────────────┘
```

---

## 🛡️ Step 1: Security Groups Setup in AWS

Create two Security Groups in the **AWS VPC Console**:

### Security Group 1: `sg-web-nginx` (Attached to Web EC2)
| Type | Protocol | Port Range | Source | Description |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Public Web Traffic |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure SSL Traffic |
| **SSH** | TCP | `22` | `Your-IP/32` | Secure Admin SSH |

### Security Group 2: `sg-database-mysql` (Attached to DB EC2)
| Type | Protocol | Port Range | Source | Description |
| :--- | :--- | :--- | :--- | :--- |
| **MYSQL/Aurora** | TCP | `3306` | `sg-web-nginx` (or Web Private IP) | **Private DB Traffic from Web Server only** |
| **SSH** | TCP | `22` | `Your-IP/32` | Secure Admin SSH |

---

## 🚀 Step 2: Provision the Two EC2 Instances

Launch **2 EC2 Instances** in your AWS Console (or use the provided Terraform script in `aws/terraform/`):
- **AMI**: Ubuntu 22.04 LTS (HVM)
- **Instance Type**: `t3.small` or `t2.micro`
- **Instance 1**: Name = `Verdad-Web-Nginx`, Security Group = `sg-web-nginx`
- **Instance 2**: Name = `Verdad-Database`, Security Group = `sg-database-mysql`

Note down the **Private IP addresses** of both instances:
- `WEB_PRIVATE_IP`: e.g. `10.0.1.50` (or `172.31.x.x`)
- `DB_PRIVATE_IP`: e.g. `10.0.2.100` (or `172.31.y.y`)

---

## 🗄️ Step 3: Configure EC2 Instance 2 (Database Server)

SSH into your **Database EC2 Instance**:
```bash
ssh -i your-key.pem ubuntu@<DATABASE_EC2_PUBLIC_IP>
```

### Option A: 1-Command Automated Database Setup
```bash
curl -fsSL https://raw.githubusercontent.com/lesileugwulebo/t11_webpage/main/aws/setup_database_ec2.sh -o setup_database_ec2.sh
sudo bash setup_database_ec2.sh <WEB_EC2_PRIVATE_IP>
```

### Option B: Manual Database Setup
1. **Install MySQL Server**:
   ```bash
   sudo apt update && sudo apt install -y mysql-server curl git
   ```

2. **Configure MySQL to listen on the Private Network**:
   Edit `/etc/mysql/mysql.conf.d/mysqld.cnf`:
   ```bash
   sudo sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
   sudo systemctl restart mysql
   ```

3. **Create Database and Grant Privileges to Web EC2 Private IP**:
   ```bash
   sudo mysql
   ```
   Execute the following SQL commands (replace `10.0.1.50` with your actual `WEB_PRIVATE_IP`):
   ```sql
   CREATE DATABASE IF NOT EXISTS `inventory_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   -- Grant access to Web EC2 Private IP
   CREATE USER IF NOT EXISTS 'inventory_user'@'10.0.1.50' IDENTIFIED WITH mysql_native_password BY 'inventory_pass_123';
   GRANT ALL PRIVILEGES ON `inventory_db`.* TO 'inventory_user'@'10.0.1.50';
   
   FLUSH PRIVILEGES;
   EXIT;
   ```

4. **Import Database Schema & Initial Catalog**:
   ```bash
   curl -sSL https://raw.githubusercontent.com/lesileugwulebo/t11_webpage/main/backend/schema.sql -o schema.sql
   sudo mysql inventory_db < schema.sql
   ```

5. **Verify Database Setup**:
   ```bash
   sudo mysql -e "USE inventory_db; SHOW TABLES; SELECT name, sku, unit_price FROM inventory_items LIMIT 3;"
   ```

---

## 🌐 Step 4: Configure EC2 Instance 1 (Web & Nginx Server)

SSH into your **Web & Nginx EC2 Instance**:
```bash
ssh -i your-key.pem ubuntu@<WEB_EC2_PUBLIC_IP>
```

### Option A: 1-Command Automated Web Setup
```bash
curl -fsSL https://raw.githubusercontent.com/lesileugwulebo/t11_webpage/main/aws/setup_web_ec2.sh -o setup_web_ec2.sh
sudo bash setup_web_ec2.sh <DATABASE_EC2_PRIVATE_IP>
```

### Option B: Manual Web Setup
1. **Install Nginx, Python 3, Node.js & MySQL Client**:
   ```bash
   sudo apt update
   sudo apt install -y nginx python3 python3-pip nodejs npm curl git mysql-client
   ```

2. **Test Database Connectivity from Web EC2 to DB EC2**:
   ```bash
   mysql -h <DATABASE_EC2_PRIVATE_IP> -u inventory_user -pinventory_pass_123 -e "USE inventory_db; SHOW TABLES;"
   ```
   *(If this connects, your private AWS VPC networking and security groups are working perfectly!)*

3. **Clone the Application**:
   ```bash
   git clone https://github.com/lesileugwulebo/t11_webpage.git /home/ubuntu/t11_webpage
   cd /home/ubuntu/t11_webpage
   ```

4. **Create Environment Configuration (`.env`)**:
   ```bash
   cat > backend/node_backend/.env << EOF
   PORT=5000
   NODE_ENV=production
   DB_HOST=<DATABASE_EC2_PRIVATE_IP>
   DB_USER=inventory_user
   DB_PASSWORD=inventory_pass_123
   DB_NAME=inventory_db
   DB_PORT=3306
   JWT_SECRET=verdad_solution_inventory_super_secret_jwt_key_2026
   EOF
   ```

5. **Create Systemd Service (`/etc/systemd/system/verdad-inventory.service`)**:
   ```ini
   [Unit]
   Description=Verdad Solution InventoryApp Server
   After=network.target

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

   Start and enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable verdad-inventory
   sudo systemctl start verdad-inventory
   ```

6. **Configure Nginx Reverse Proxy (`/etc/nginx/sites-available/verdad-inventory.conf`)**:
   ```nginx
   server {
       listen 80;
       server_name _;

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

   Enable the site and reload Nginx:
   ```bash
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo ln -s /etc/nginx/sites-available/verdad-inventory.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 🧪 Step 5: Test & Verify Deployment

1. **Open your browser and navigate to**:
   ```
   http://<WEB_EC2_PUBLIC_IP>
   ```

2. **Log in with the Default Credentials**:
   - **Administrator**: `admin` / `admin123`
   - **Staff Member**: `user` / `user123`

3. **Run Automated Test Suite on Web EC2**:
   ```bash
   cd /home/ubuntu/t11_webpage
   ./test_linux.sh
   ```

---

## 🔒 Optional: Production SSL / HTTPS Setup

To attach a domain and obtain free automated SSL from Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d inventory.yourdomain.com
```

---

## 🏗️ Deploy via Terraform (Optional Infrastructure as Code)

If you have Terraform configured with your AWS credentials:

```bash
cd aws/terraform
terraform init
terraform apply -var="key_name=your-ec2-keypair-name"
```
Terraform will automatically create the VPC, subnets, route tables, security groups, and both EC2 instances, outputting the public and private IP addresses ready for installation.
