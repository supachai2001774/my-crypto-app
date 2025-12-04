-- Database Schema for Crypto Miner Tycoon
-- Compatible with MySQL 8.0+

CREATE DATABASE IF NOT EXISTS crypto_miner_db;
USE crypto_miner_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    bank_name VARCHAR(50),
    bank_account VARCHAR(20),
    balance DECIMAL(15, 2) DEFAULT 0.00,
    hashrate DECIMAL(10, 2) DEFAULT 0.00,
    referrer_id INT,
    profile_image LONGTEXT,
    ip_address VARCHAR(45),
    device_id VARCHAR(100),
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('deposit', 'withdraw', 'mining_profit', 'referral_bonus', 'referral_commission', 'buy_item') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    method VARCHAR(50), -- e.g., 'bank_transfer', 'qr_code', 'system'
    slip_image LONGTEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Shop Items (Products)
CREATE TABLE IF NOT EXISTS shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    mining_speed DECIMAL(10, 2) NOT NULL, -- Hashrate increase
    tier ENUM('basic', 'mid', 'pro', 'legendary', 'limited') DEFAULT 'basic',
    icon_class VARCHAR(50), -- e.g., 'fa-microchip'
    tags VARCHAR(50), -- e.g., 'hot,new'
    stock INT DEFAULT -1, -- -1 = unlimited
    is_active BOOLEAN DEFAULT TRUE
);

-- Seed Data for Shop
INSERT INTO shop_items (name, price, mining_speed, tier, icon_class, tags) VALUES
('ชุดขุด Bitcoin เริ่มต้น (24ชม.)', 0, 0.05, 'limited', 'fa-bitcoin', 'free'),
('การ์ดจอ GTX 1060 (เริ่มต้น)', 500, 0.50, 'basic', 'fa-fan', ''),
('แท่นขุด Titanium Mk1', 12000, 12.00, 'mid', 'fa-hammer', 'used'),
('การ์ดจอ RTX 3060 Ti', 2500, 2.50, 'mid', 'fa-memory', ''),
('การ์ดจอ RTX 4090 Ultimate', 9500, 8.00, 'pro', 'fa-microchip', 'hot'),
('เครื่องขุด ASIC S19 Pro', 28000, 25.00, 'pro', 'fa-server', ''),
('แท่นขุด Quantum V1', 85000, 80.00, 'legendary', 'fa-atom', 'new');

-- 4. User Rigs (Purchased Items)
CREATE TABLE IF NOT EXISTS user_rigs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT,
    name VARCHAR(100),
    speed DECIMAL(10, 2) NOT NULL,
    purchase_price DECIMAL(15, 2),
    status ENUM('active', 'stopped', 'expired') DEFAULT 'active',
    expires_at TIMESTAMP NULL, -- For temporary items
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE SET NULL
);

-- 5. Referrals
CREATE TABLE IF NOT EXISTS referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referrer_id INT NOT NULL,
    referee_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'fraud') DEFAULT 'pending',
    commission_claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_referral (referee_id) -- One referrer per user
);

-- 6. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value) VALUES
('maintenance_mode', 'false'),
('maintenance_message', ''),
('admin_promptpay_number', ''),
('admin_promptpay_name', ''),
('announcement_text', '');

-- 7. Admin Logs
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_username VARCHAR(50),
    action VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);