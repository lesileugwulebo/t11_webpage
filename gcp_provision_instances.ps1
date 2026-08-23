# ==============================================================================
# Direct In-Guest Provisioning for GCP VMs
# ==============================================================================

Write-Host "--- 1. Provisioning MySQL Database Server (inventory-db) ---" -ForegroundColor Cyan

$dbCommands = @'
sudo apt-get update -y
sudo apt-get install -y mysql-server git

sudo sed -i "s/127.0.0.1/0.0.0.0/" /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql
sudo systemctl enable mysql

sudo mysql -u root << 'EOSQL'
CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'inventory_app'@'%' IDENTIFIED BY 'StrongGcpPass2026!';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_app'@'%';
FLUSH PRIVILEGES;
EOSQL

rm -rf /tmp/miva_project
git clone https://github.com/lesileugwulebo/t11_webpage.git /tmp/miva_project
sudo mysql -u root inventory_db < /tmp/miva_project/backend/schema.sql
rm -rf /tmp/miva_project

echo "MySQL Database Ready on GCP!"
'@

gcloud compute ssh inventory-db --zone=europe-west1-b --command="$dbCommands" --quiet

Write-Host "--- 2. Provisioning Web & Node.js Application Server (inventory-web-app) ---" -ForegroundColor Cyan

$webCommands = @'
sudo apt-get update -y
sudo apt-get install -y curl git nginx python3 python3-pip

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo mkdir -p /var/www/inventory-app
sudo chown -R $USER:$USER /var/www/inventory-app

rm -rf /var/www/inventory-app/* /var/www/inventory-app/.[!.]*
git clone https://github.com/lesileugwulebo/t11_webpage.git /var/www/inventory-app

cd /var/www/inventory-app/backend/node_backend
npm install --production

cat << 'ENVFILE' > /var/www/inventory-app/backend/node_backend/.env
PORT=5000
NODE_ENV=production
DB_HOST=10.10.0.2
DB_PORT=3306
DB_USER=inventory_app
DB_PASS=StrongGcpPass2026!
DB_NAME=inventory_db
JWT_SECRET=production_gcp_deployment_secret_key_2026
ENVFILE

sudo bash -c 'cat << "SERVICEFILE" > /etc/systemd/system/inventory-app.service
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
SERVICEFILE'

sudo systemctl daemon-reload
sudo systemctl enable --now inventory-app

sudo bash -c 'cat << "NGINXFILE" > /etc/nginx/sites-available/inventory-app
server {
    listen 80 default_server;
    listen [::]:80 default_server;
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
NGINXFILE'

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

echo "Verdad Solution InventoryApp successfully running on GCP!"
'@

gcloud compute ssh inventory-web-app --zone=europe-west1-b --command="$webCommands" --quiet

Write-Host "--- 3. Running Verification Suite on GCP Web VM ---" -ForegroundColor Green
gcloud compute ssh inventory-web-app --zone=europe-west1-b --command="cd /var/www/inventory-app && bash test_linux.sh" --quiet
