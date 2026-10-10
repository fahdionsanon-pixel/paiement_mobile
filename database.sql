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
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) UNIQUE NOT NULL,
  `initials` VARCHAR(10) NOT NULL DEFAULT 'AD',
  `balance` DECIMAL(15, 2) NOT NULL DEFAULT 1450000.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'XOF',
  `cashback` DECIMAL(15, 2) NOT NULL DEFAULT 14500.00,
  `verified` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table Cartes Virtuelles
CREATE TABLE IF NOT EXISTS `cards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `card_number` VARCHAR(30) NOT NULL DEFAULT '4532 •••• •••• 8921',
  `card_holder` VARCHAR(100) NOT NULL DEFAULT 'AMADOU DIALLO',
  `expiry` VARCHAR(10) NOT NULL DEFAULT '08/29',
  `cvv` VARCHAR(4) NOT NULL DEFAULT '742',
  `is_frozen` TINYINT(1) NOT NULL DEFAULT 0,
  `card_tier` VARCHAR(30) NOT NULL DEFAULT 'GOLD METAL',
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

-- ===================================================
-- Données Initiales de Démonstration
-- ===================================================

-- Insérer l'utilisateur principal
INSERT INTO `users` (`id`, `name`, `phone`, `initials`, `balance`, `currency`, `cashback`, `verified`)
VALUES (1, 'Amadou Diallo', '+221 77 458 92 10', 'AD', 1450000.00, 'XOF', 14500.00, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Insérer la carte virtuelle
INSERT INTO `cards` (`user_id`, `card_number`, `card_holder`, `expiry`, `cvv`, `is_frozen`, `card_tier`)
VALUES (1, '4532 •••• •••• 8921', 'AMADOU DIALLO', '08/29', '742', 0, 'GOLD METAL')
ON DUPLICATE KEY UPDATE `card_holder` = VALUES(`card_holder`);

-- Insérer les contacts fréquents
INSERT INTO `contacts` (`user_id`, `name`, `phone`, `initials`, `color`) VALUES
(1, 'Aïssatou D.', '+221 77 123 45 67', 'AD', 'linear-gradient(135deg, #8b5cf6, #6366f1)'),
(1, 'Moussa S.', '+221 70 876 54 32', 'MS', 'linear-gradient(135deg, #06b6d4, #0284c7)'),
(1, 'Fatou K.', '+221 76 345 67 89', 'FK', 'linear-gradient(135deg, #ec4899, #db2777)'),
(1, 'Ousmane B.', '+221 78 901 23 45', 'OB', 'linear-gradient(135deg, #10b981, #059669)'),
(1, 'Khadija T.', '+221 77 654 32 10', 'KT', 'linear-gradient(135deg, #f59e0b, #d97706)');

-- Insérer l'objectif d'épargne
INSERT INTO `savings_goals` (`user_id`, `title`, `current_amount`, `target_amount`, `percent`) VALUES
(1, 'Objectif Projet Immobilier', 1850000.00, 2500000.00, 74);

-- Insérer les transactions initiales
INSERT INTO `transactions` 
(`tx_reference`, `user_id`, `title`, `subtitle`, `category`, `category_label`, `icon`, `icon_bg`, `icon_color`, `amount`, `type`, `date_label`, `time_label`, `status`, `fees`)
VALUES
('AUCH-DKR-88310', 1, 'Supermarché Auchan Almadies', 'Paiement sans contact QR', 'shopping', 'Alimentation', 'cart', 'rgba(236, 72, 153, 0.15)', '#ec4899', 18500.00, 'debit', 'Aujourd’hui', '14:28', 'completed', 0.00),
('TR-PAY-99210', 1, 'Virement de Moussa S.', 'Transfert instantané PayPulse', 'transfer', 'Reçu', 'arrow-down', 'rgba(16, 185, 129, 0.15)', '#10b981', 35000.00, 'credit', 'Aujourd’hui', '11:15', 'completed', 0.00),
('SNLC-2026-771', 1, 'Facture Électricité Senelec', 'Paiement service Woyofal', 'bills', 'Énergie', 'flash', 'rgba(245, 158, 11, 0.15)', '#f59e0b', 14200.00, 'debit', 'Hier', '18:40', 'completed', 100.00),
('NFLX-SUB-0492', 1, 'Netflix Premium', 'Abonnement mensuel carte virtuelle', 'subscriptions', 'Loisirs', 'play-circle', 'rgba(99, 102, 241, 0.15)', '#818cf8', 8500.00, 'debit', '08 Oct 2026', '09:00', 'completed', 0.00),
('VISA-DEP-5510', 1, 'Recharge Carte Bancaire', 'Dépôt Visa International', 'topup', 'Recharge', 'wallet', 'rgba(6, 182, 212, 0.15)', '#06b6d4', 200000.00, 'credit', '05 Oct 2026', '16:12', 'completed', 0.00),
('REST-LAG-114', 1, 'Restaurant Le Lagon 1', 'Paiement TPE Marchand', 'food', 'Restaurant', 'restaurant', 'rgba(249, 115, 22, 0.15)', '#f97316', 42000.00, 'debit', '03 Oct 2026', '21:30', 'completed', 0.00),
('ORG-TEL-732', 1, 'Crédit Téléphonique Orange', 'Pass Internet Illimité 30J', 'airtime', 'Télécom', 'phone-portrait', 'rgba(59, 130, 246, 0.15)', '#3b82f6', 10000.00, 'debit', '01 Oct 2026', '10:04', 'completed', 0.00);
