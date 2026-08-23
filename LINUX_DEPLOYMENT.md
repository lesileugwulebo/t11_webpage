# 🐧 Linux Deployment & Testing Guide - Verdad Solution InventoryApp

This guide explains how to deploy, run, and test **Verdad Solution InventoryApp** on any Linux distribution (Ubuntu, Debian, CentOS, Rocky Linux, RHEL, Arch Linux, or WSL2).

---

## ⚡ Method 1: Instant Run (Quickest)

You can run the application directly using Python 3:

```bash
# 1. Grant execution permissions
chmod +x start_server.sh test_linux.sh deploy_linux.sh

# 2. Start the server
./start_server.sh
```

The application will start on **`http://localhost:5000`** (or your server's IP address on port 5000).

---

## 🧪 Automated Linux Testing

We included a native bash test suite that validates all 10 API operations and authentication flows using `curl`:

```bash
# In a new terminal while the server is running:
./test_linux.sh
```

**What it tests:**
1. Healthcheck endpoint (`/api/health`)
2. Staff User Authentication (`/api/auth/login`)
3. Admin Authentication (`/api/auth/admin-login`)
4. Inventory catalog listing
5. Total Inventory metrics & valuation computation in Naira (₦)
6. Dynamic Product Creation (SKU, Price, Threshold)
7. Stock Restock (+10 units)
8. User "Today's Work" activity tally
9. Administrator User Provisioning
10. Stock item deletion & audit trail verification

---

## 🐳 Method 2: Docker & Docker Compose (Recommended for Production)

Run the containerized application alongside a dedicated **MySQL 8.0** database:

```bash
# 1. Start MySQL and the InventoryApp in background
docker compose up -d

# 2. Check container health & status
docker compose ps

# 3. View live server logs
docker compose logs -f
```

The database schema `backend/schema.sql` is automatically mounted and initialized into MySQL on first boot.

To stop the containers:
```bash
docker compose down
```

---

## ⚙️ Method 3: Systemd Service (Auto-Start on Boot)

To run the application as a background Linux system service that automatically restarts on system reboot or failures:

```bash
# Run the automated installer with root privileges:
sudo ./deploy_linux.sh --systemd
```

### Manual Systemd Management Commands:
```bash
# Start service
sudo systemctl start inventory-app

# Check status
sudo systemctl status inventory-app

# Stop service
sudo systemctl stop inventory-app

# View live systemd logs
sudo journalctl -u inventory-app -f
```

---

## 🌐 Method 4: Nginx Reverse Proxy + SSL (Port 80/443)

1. **Install Nginx**:
   ```bash
   sudo apt update && sudo apt install -y nginx
   ```

2. **Copy the configuration**:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/verdad-inventory.conf
   sudo ln -s /etc/nginx/sites-available/verdad-inventory.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Optional: Free SSL via Let's Encrypt (Certbot)**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## 🔐 Default Demo Accounts

| Role | Username | Password | Dashboard Features |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full stock oversight, User creation, System audit logs |
| **Staff Member** | `user` | `user123` | "Today's Work" timeline, Add/Adjust stock in Naira (₦) |
