<?php
// Delete user by phone number
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$phone = isset($input['phone']) ? trim($input['phone']) : '';

if (empty($phone)) {
    jsonResponse(['success' => false, 'message' => 'Numéro de téléphone requis'], 400);
}

// Clean phone number
$cleanPhone = preg_replace('/[^0-9]/', '', $phone);

try {
    // Find the user
    $stmtUser = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $stmtUser->execute([$cleanPhone]);
    $user = $stmtUser->fetch();

    if (!$user) {
        jsonResponse(['success' => true, 'message' => 'Utilisateur déjà absent de la base de données.']);
    }

    $userId = (int)$user['id'];

    // Delete in order (respect foreign keys)
    $pdo->beginTransaction();

    $pdo->prepare('DELETE FROM transactions WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM savings_goals WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM contacts WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM cards WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

    $pdo->commit();

    jsonResponse([
        'success' => true,
        'message' => "Utilisateur $cleanPhone et toutes ses données ont été supprimés avec succès.",
        'deletedUserId' => $userId,
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la suppression : ' . $e->getMessage()
    ], 500);
}