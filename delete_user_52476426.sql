-- ===================================================
-- Script de suppression d'un utilisateur par numéro de téléphone
-- À exécuter dans phpMyAdmin ou la ligne de commande MySQL
-- ===================================================

-- Remplacez le numéro ci-dessous par celui que vous souhaitez supprimer
SET @phone_to_delete = '52476426';

-- Supprimer les données associées (l'ordre respecte les clés étrangères)
DELETE FROM transactions WHERE user_id = (SELECT id FROM users WHERE phone = @phone_to_delete);
DELETE FROM savings_goals WHERE user_id = (SELECT id FROM users WHERE phone = @phone_to_delete);
DELETE FROM contacts WHERE user_id = (SELECT id FROM users WHERE phone = @phone_to_delete);
DELETE FROM cards WHERE user_id = (SELECT id FROM users WHERE phone = @phone_to_delete);
DELETE FROM users WHERE phone = @phone_to_delete;

-- Vérifier que l'utilisateur a été supprimé
SELECT COUNT(*) AS users_restant FROM users WHERE phone = @phone_to_delete;