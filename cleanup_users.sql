-- ===================================================
-- Script de nettoyage et de correction des comptes utilisateurs
-- À exécuter une fois pour corriger les doublons de profils
-- ===================================================

USE `paiement_mobile_db`;

-- 1. Voir les utilisateurs existants
SELECT id, name, phone, balance, verified FROM users ORDER BY id;

-- 2. Identifier les doublons de numéros de téléphone (normalisés)
-- (Décommentez pour voir les doublons)
-- SELECT 
--     REPLACE(REPLACE(REPLACE(REPLACE(phone, "+", ""), " ", ""), "-", ""), "(", "") AS phone_clean,
--     GROUP_CONCAT(id ORDER BY id) AS user_ids,
--     COUNT(*) AS count
-- FROM users
-- GROUP BY phone_clean
-- HAVING count > 1;

-- 3. Supprimer les utilisateurs sans numéro de téléphone (sauf le premier)
-- DELETE FROM users WHERE (phone IS NULL OR phone = '') AND id > 1;

-- 4. Supprimer l'utilisateur 52476426 si vous voulez le supprimer complètement
-- (Décommentez la ligne ci-dessous)
-- DELETE FROM transactions WHERE user_id = (SELECT id FROM users WHERE phone LIKE '%52476426%');
-- DELETE FROM savings_goals WHERE user_id = (SELECT id FROM users WHERE phone LIKE '%52476426%');
-- DELETE FROM contacts WHERE user_id = (SELECT id FROM users WHERE phone LIKE '%52476426%');
-- DELETE FROM cards WHERE user_id = (SELECT id FROM users WHERE phone LIKE '%52476426%');
-- DELETE FROM users WHERE phone LIKE '%52476426%';

-- 5. Vérifier après nettoyage
SELECT id, name, phone, balance, verified FROM users ORDER BY id;