-- ===================================================
-- Base de Données : paiement_mobile_db
-- Pour WampServer (MySQL / MariaDB)
-- Application : PayPulse Mobile Payment
-- ===================================================

CREATE DATABASE IF NOT EXISTS `paiement_mobile_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `paiement_mobile_db`;

-- 1. Table Utilisateurs (Profil et Solde)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL DEFAULT '',
  `phone` VARCHAR(30) UNIQUE NOT NULL DEFAULT '',
  `initials` VARCHAR(10) NOT NULL DEFAULT '',
  `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'XOF',
  `cashback` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table Cartes Virtuelles
CREATE TABLE IF NOT EXISTS `cards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `card_number` VARCHAR(30) NOT NULL DEFAULT '',
  `card_holder` VARCHAR(100) NOT NULL DEFAULT '',
  `expiry` VARCHAR(10) NOT NULL DEFAULT '',
  `cvv` VARCHAR(4) NOT NULL DEFAULT '',
  `is_frozen` TINYINT(1) NOT NULL DEFAULT 0,
  `card_tier` VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table Contacts Fréquents
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `initials` VARCHAR(10) NOT NULL,
  `color` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Table Transactions
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tx_reference` VARCHAR(50) UNIQUE NOT NULL,
  `user_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `subtitle` VARCHAR(255) DEFAULT NULL,
  `category` VARCHAR(50) NOT NULL,
  `category_label` VARCHAR(50) NOT NULL,
  `icon` VARCHAR(50) NOT NULL,
  `icon_bg` VARCHAR(60) NOT NULL,
  `icon_color` VARCHAR(30) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `type` ENUM('debit', 'credit') NOT NULL,
  `date_label` VARCHAR(50) NOT NULL,
  `time_label` VARCHAR(20) NOT NULL,
  `status` ENUM('completed', 'pending', 'failed') NOT NULL DEFAULT 'completed',
  `fees` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Table Objectifs d'Épargne
CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `current_amount` DECIMAL(15, 2) NOT NULL DEFAULT 1850000.00,
  `target_amount` DECIMAL(15, 2) NOT NULL DEFAULT 2500000.00,
  `percent` INT NOT NULL DEFAULT 74,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Table OTPs WhatsApp (pour l'authentification)
CREATE TABLE IF NOT EXISTS `whatsapp_otps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(30) NOT NULL,
  `otp` VARCHAR(10) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_verified (phone, verified),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================================================
-- Initialisation Compte Vide
-- ===================================================

INSERT INTO `users` (`id`, `name`, `phone`, `initials`, `balance`, `currency`, `cashback`, `verified`)
VALUES (1, '', '', '', 0.00, 'XOF', 0.00, 0)
ON DUPLICATE KEY UPDATE `balance` = 0.00, `name` = '';

