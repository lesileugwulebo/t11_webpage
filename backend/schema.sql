-- =======================================================
-- Simple Inventory Application - MySQL Database Schema
-- =======================================================

CREATE DATABASE IF NOT EXISTS `inventory_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inventory_db`;

-- -------------------------------------------------------
-- Table: users
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- Table: inventory_items
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sku` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT,
    `category` VARCHAR(50) NOT NULL DEFAULT 'General',
    `unit_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `quantity` INT NOT NULL DEFAULT 0,
    `min_threshold` INT NOT NULL DEFAULT 5,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- Table: stock_transactions (Audit trail and daily activity)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `item_id` INT NULL,
    `item_name` VARCHAR(150) NOT NULL,
    `user_id` INT NULL,
    `user_name` VARCHAR(100) NOT NULL,
    `user_role` VARCHAR(20) NOT NULL,
    `transaction_type` ENUM('CREATE', 'RESTOCK', 'ADJUSTMENT', 'UPDATE', 'DELETE') NOT NULL,
    `quantity_change` INT NOT NULL DEFAULT 0,
    `previous_quantity` INT NOT NULL DEFAULT 0,
    `new_quantity` INT NOT NULL DEFAULT 0,
    `reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- Initial Seeds
-- -------------------------------------------------------
-- Default Admin: username: admin | password: admin123
-- Default User:  username: user  | password: user123
INSERT INTO `users` (`id`, `username`, `password`, `full_name`, `email`, `role`, `status`)
VALUES 
(1, 'admin', 'admin123', 'System Administrator', 'admin@inventory.local', 'admin', 'active'),
(2, 'user', 'user123', 'Warehouse Operator', 'user@inventory.local', 'user', 'active'),
(3, 'sarah_tech', 'user123', 'Sarah Jenkins', 'sarah@inventory.local', 'user', 'active')
ON DUPLICATE KEY UPDATE `username`=`username`;

INSERT INTO `inventory_items` (`id`, `sku`, `name`, `description`, `category`, `unit_price`, `quantity`, `min_threshold`, `created_by`)
VALUES
(1, 'ELEC-MBP-14', 'MacBook Pro 14" M3', '16GB RAM, 512GB SSD Space Gray', 'Electronics', 1999000.00, 24, 5, 1),
(2, 'ELEC-DELL-27', 'Dell UltraSharp 27" 4K Monitor', 'IPS USB-C Hub Monitor (U2723QE)', 'Electronics', 589500.00, 18, 4, 1),
(3, 'PERI-MXM-3S', 'Logitech MX Master 3S', 'Performance Wireless Mouse with Quiet Clicks', 'Peripherals', 99900.00, 45, 10, 1),
(4, 'PERI-KEY-MX', 'Logitech MX Mechanical Keyboard', 'Wireless Illuminated Keyboard Tactile Quiet', 'Peripherals', 149900.00, 3, 5, 1),
(5, 'FURN-CHR-ERG', 'Ergonomic Mesh Office Chair', 'High back with adjustable lumbar and 3D armrests', 'Furniture', 320000.00, 12, 3, 1),
(6, 'FURN-DSK-STD', 'Motorized Standing Desk 60x30', 'Dual motor height adjustable frame with oak top', 'Furniture', 450000.00, 2, 4, 1),
(7, 'STAT-NOT-A5', 'Premium Hardcover Notebook A5', '120gsm dotted grid acid-free paper', 'Stationery', 14500.00, 150, 20, 2),
(8, 'STAT-PEN-GEL', 'Pilot G2 0.7mm Gel Pens (Pack of 12)', 'Smooth writing black ink rollerball', 'Stationery', 18000.00, 68, 15, 2)
ON DUPLICATE KEY UPDATE `sku`=`sku`;

INSERT INTO `stock_transactions` (`item_id`, `item_name`, `user_id`, `user_name`, `user_role`, `transaction_type`, `quantity_change`, `previous_quantity`, `new_quantity`, `reason`, `created_at`)
VALUES
(1, 'MacBook Pro 14" M3', 1, 'System Administrator', 'admin', 'CREATE', 24, 0, 24, 'Initial stock setup', NOW()),
(2, 'Dell UltraSharp 27" 4K Monitor', 1, 'System Administrator', 'admin', 'CREATE', 18, 0, 18, 'Initial stock setup', NOW()),
(3, 'Logitech MX Master 3S', 1, 'System Administrator', 'admin', 'CREATE', 45, 0, 45, 'Initial stock setup', NOW()),
(4, 'Logitech MX Mechanical Keyboard', 2, 'Warehouse Operator', 'user', 'RESTOCK', 10, 0, 10, 'Supplier delivery received', NOW()),
(4, 'Logitech MX Mechanical Keyboard', 2, 'Warehouse Operator', 'user', 'ADJUSTMENT', -7, 10, 3, 'Dispatched for new hires', NOW()),
(7, 'Premium Hardcover Notebook A5', 2, 'Warehouse Operator', 'user', 'CREATE', 150, 0, 150, 'Stationery restock', NOW());
