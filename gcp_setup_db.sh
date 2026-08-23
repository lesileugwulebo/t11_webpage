#!/bin/bash
set -e

echo "=== 1. Setting up MySQL 8.0 on inventory-db ==="
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

echo "=== MySQL Database Setup Completed Successfully! ==="
