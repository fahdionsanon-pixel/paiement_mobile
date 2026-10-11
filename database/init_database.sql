-- ===================================================
-- PayPulse - Script d'initialisation de la base de données MySQL
-- Base : paiement_mobile_db (WampServer)
-- ===================================================

CREATE DATABASE IF NOT EXISTS `paiement_mobile_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `paiement_mobile_db`;

-- ===================================================
-- TABLE: users (Utilisateurs)
-- ===================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `initials` VARCHAR(5) NOT NULL DEFAULT '',
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `cashback` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================================================
-- TABLE: cards (Cartes virtuelles)
-- ===================================================
CREATE TABLE IF NOT EXISTS `cards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `card_number` VARCHAR(30) NOT NULL,
  `card_holder` VARCHAR(255) NOT NULL,
  `expiry` VARCHAR(10) NOT NULL,
  `cvv` VARCHAR(5) NOT NULL,
  `is_frozen` TINYINT(1) NOT NULL DEFAULT 0,
  `card_tier` VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================================================
-- TABLE: contacts (Contacts rapides)
-- ===================================================
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `initials` VARCHAR(5) NOT NULL DEFAULT '',
  `color` VARCHAR(255) NOT NULL DEFAULT 'linear-gradient(135deg, #6366f1, #4f46e5)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================================================
-- TABLE: savings_goals (Objectifs d'épargne)
-- ===================================================
CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `current_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `target_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `percent` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================================================
-- TABLE: transactions (Historique des transactions)
-- ===================================================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tx_reference` VARCHAR(50) NOT NULL UNIQUE,
  `user_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(255) NOT NULL DEFAULT '',
  `category` VARCHAR(50) NOT NULL DEFAULT 'transfer',
  `category_label` VARCHAR(100) NOT NULL DEFAULT 'Opération',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `icon_bg` VARCHAR(100) NOT NULL DEFAULT 'rgba(99, 102, 241, 0.15)',
  `icon_color` VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `type` ENUM('debit','credit') NOT NULL DEFAULT 'debit',
  `date_label` VARCHAR(50) NOT NULL DEFAULT '',
  `time_label` VARCHAR(10) NOT NULL DEFAULT '',
  `status` ENUM('completed','pending','failed') NOT NULL DEFAULT 'completed',
  `fees` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================================================
-- INITIALISATION COMPTE VIDE
-- ===================================================

INSERT INTO `users` (`id`, `name`, `phone`, `initials`, `verified`, `balance`, `cashback`)
VALUES (1, '', '', '', 0, 0.00, 0.00)
ON DUPLICATE KEY UPDATE `balance` = 0.00, `name` = '';

