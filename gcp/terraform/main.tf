# ==============================================================================
# Google Cloud Platform (GCP) 2-Tier Architecture Terraform Configuration
# Verdad Solution InventoryApp with Node.js/Python, MySQL & Microsoft Entra ID
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ------------------------------------------------------------------------------
# Random Password Generation for Database
# ------------------------------------------------------------------------------
resource "random_password" "db_password" {
  length  = 20
  special = false
}

locals {
  db_pass = var.db_password != "" ? var.db_password : random_password.db_password.result
}

# ------------------------------------------------------------------------------
# VPC Network & Subnet
# ------------------------------------------------------------------------------
resource "google_compute_network" "inventory_vpc" {
  name                    = "inventory-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "inventory_subnet" {
  name          = "inventory-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.inventory_vpc.id
}

# ------------------------------------------------------------------------------
# Firewall Rules
# ------------------------------------------------------------------------------

# 1. Allow Public Web (HTTP 80, HTTPS 443) and SSH (Port 22)
resource "google_compute_firewall" "allow_web" {
  name    = "inventory-allow-web"
  network = google_compute_network.inventory_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["inventory-web"]
}

# 2. Allow Internal MySQL (Port 3306) from Web Tier to Database Tier
resource "google_compute_firewall" "allow_internal_db" {
  name    = "inventory-allow-internal-db"
  network = google_compute_network.inventory_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["3306", "22"]
  }

  source_tags = ["inventory-web"]
  target_tags = ["inventory-db"]
}

# ------------------------------------------------------------------------------
# Static External IP Address for Web Tier
# ------------------------------------------------------------------------------
resource "google_compute_address" "web_static_ip" {
  name   = "inventory-web-static-ip"
  region = var.region
}

# ------------------------------------------------------------------------------
# Database Compute Engine Instance (Tier 2)
# ------------------------------------------------------------------------------
resource "google_compute_instance" "db_server" {
  name         = "inventory-db"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["inventory-db"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 20
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.inventory_subnet.id
    access_config {
      // Ephemeral public IP for package downloads
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e
    exec > /var/log/startup-script-db.log 2>&1

    echo "=== Provisioning MySQL 8.0 Database Server ==="
    export DEBIAN_FRONTEND=noninteractive

    apt-get update -y
    apt-get install -y mysql-server git

    # Bind MySQL to 0.0.0.0 to allow VPC connections
    sed -i 's/127.0.0.1/0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
    systemctl restart mysql
    systemctl enable mysql

    # Setup Database and App User
    mysql -u root << 'EOSQL'
    CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'inventory_app'@'%' IDENTIFIED BY '${local.db_pass}';
    GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_app'@'%';
    FLUSH PRIVILEGES;
    EOSQL

    # Clone and Import Schema
    git clone https://github.com/lesileugwulebo/t11_webpage.git /tmp/miva_project
    mysql -u root inventory_db < /tmp/miva_project/backend/schema.sql
    rm -rf /tmp/miva_project

    echo "=== MySQL Database Setup Completed Successfully ==="
  EOF

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------------------------------------------------------------------
# Web & Application Compute Engine Instance (Tier 1)
# ------------------------------------------------------------------------------
resource "google_compute_instance" "web_server" {
  name         = "inventory-web-app"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["inventory-web"]

  depends_on = [google_compute_instance.db_server]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 20
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.inventory_subnet.id
    access_config {
      nat_ip = google_compute_address.web_static_ip.address
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e
    exec > /var/log/startup-script-web.log 2>&1

    echo "=== Provisioning Web & Node.js Application Server ==="
    export DEBIAN_FRONTEND=noninteractive

    apt-get update -y
    apt-get install -y curl git nginx python3 python3-pip

    # Install Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    # Clone Repository
    mkdir -p /var/www/inventory-app
    git clone https://github.com/lesileugwulebo/t11_webpage.git /var/www/inventory-app
    chown -R www-data:www-data /var/www/inventory-app

    # Install Node.js Dependencies
    cd /var/www/inventory-app/backend/node_backend
    npm install --production

    # Configure .env
    cat << 'ENVFILE' > /var/www/inventory-app/backend/node_backend/.env
    PORT=5000
    NODE_ENV=production
    DB_HOST=${google_compute_instance.db_server.network_interface.0.network_ip}
    DB_PORT=3306
    DB_USER=inventory_app
    DB_PASS=${local.db_pass}
    DB_NAME=inventory_db
    JWT_SECRET=${var.jwt_secret}
    AZURE_CLIENT_ID=${var.azure_client_id}
    AZURE_TENANT_ID=${var.azure_tenant_id}
    ENVFILE

    # Configure Systemd Service
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

    # Configure Nginx Reverse Proxy
    cat << 'NGINXFILE' > /etc/nginx/sites-available/inventory-app
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

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 30d;
            add_header Cache-Control "public, no-transform";
        }
    }
    NGINXFILE

    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
    nginx -t
    systemctl restart nginx

    echo "=== Web & App Server Setup Completed Successfully ==="
  EOF
}
