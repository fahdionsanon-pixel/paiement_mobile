<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$userId = isset($input['user_id']) ? (int)$input['user_id'] : 1;
$amount = isset($input['amount']) ? (float)$input['amount'] : 0;
$method = trim($input['method'] ?? 'card');

if ($amount <= 0) {
    jsonResponse(['success' => false, 'message' => 'Montant invalide'], 400);
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Utilisateur introuvable'], 404);
    }

    $newBalance = (float)$user['balance'] + $amount;

    $updateStmt = $pdo->prepare('UPDATE users SET balance = ? WHERE id = ?');
    $updateStmt->execute([$newBalance, $userId]);

    $methodTitle = ($method === 'card') ? 'Par Carte Bancaire' : (($method === 'bank') ? 'Par Virement Bancaire' : 'Dépôt en Agence');
    $txRef = 'DEP-VAL-' . rand(100000, 999999);
    $dateLabel = 'Aujourd’hui';
    $timeLabel = date('H:i');

    $insTx = $pdo->prepare('
        INSERT INTO transactions 
        (tx_reference, user_id, title, subtitle, category, category_label, icon, icon_bg, icon_color, amount, type, date_label, time_label, status, fees)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $insTx->execute([
        $txRef,
        $userId,
        'Recharge Compte Principal',
        $methodTitle,
        'topup',
        'Recharge',
        'wallet',
        'rgba(6, 182, 212, 0.15)',
        '#06b6d4',
        $amount,
        'credit',
        $dateLabel,
        $timeLabel,
        'completed',
        0.00
    ]);

    $pdo->commit();

    jsonResponse([
        'success' => true,
        'message' => 'Recharge enregistrée avec succès dans MySQL WAMP',
        'newBalance' => $newBalance,
        'transaction' => [
            'id' => $txRef,
            'title' => 'Recharge Compte Principal',
            'subtitle' => $methodTitle,
            'category' => 'topup',
            'categoryLabel' => 'Recharge',
            'icon' => 'wallet',
            'iconBg' => 'rgba(6, 182, 212, 0.15)',
            'iconColor' => '#06b6d4',
            'amount' => $amount,
            'type' => 'credit',
            'date' => $dateLabel,
            'time' => $timeLabel,
            'status' => 'completed',
            'reference' => $txRef,
            'fees' => 0.00
        ]
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la recharge : ' . $e->getMessage()
    ], 500);
}
