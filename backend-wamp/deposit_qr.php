<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$recipientPhone = trim($input['recipient_phone'] ?? '');
$amount = isset($input['amount']) ? (float)$input['amount'] : 0;
$note = trim($input['note'] ?? 'Dépôt direct par Scan QR');

if (empty($recipientPhone)) {
    jsonResponse(['success' => false, 'message' => 'Numéro de compte destinataire manquant'], 400);
}

if ($amount <= 0) {
    jsonResponse(['success' => false, 'message' => 'Montant invalide'], 400);
}

try {
    $pdo->beginTransaction();

    // Chercher l'utilisateur par téléphone
    $stmt = $pdo->prepare('SELECT id, balance FROM users WHERE phone = ? FOR UPDATE');
    $stmt->execute([$recipientPhone]);
    $user = $stmt->fetch();

    if (!$user) {
        // Phone not found - create a new user instead of falling back to user_id=1
        // This prevents account data from leaking between users
        $insUser = $pdo->prepare('INSERT INTO users (name, phone, initials, balance, verified) VALUES (?, ?, ?, ?, ?)');
        $insUser->execute(['', $recipientPhone, '', $amount, 1]);
        $targetUserId = (int)$pdo->lastInsertId();
        $newBalance = $amount;
    } else {
        $targetUserId = (int)$user['id'];
        $newBalance = (float)$user['balance'] + $amount;
        $upd = $pdo->prepare('UPDATE users SET balance = ? WHERE id = ?');
        $upd->execute([$newBalance, $targetUserId]);
    }

    $txRef = 'DEP-QR-' . time() . '-' . rand(1000, 9999);
    $dateLabel = 'Aujourd’hui';
    $timeLabel = date('H:i');

    $insTx = $pdo->prepare('
        INSERT INTO transactions 
        (tx_reference, user_id, title, subtitle, category, category_label, icon, icon_bg, icon_color, amount, type, date_label, time_label, status, fees)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $insTx->execute([
        $txRef,
        $targetUserId,
        "Dépôt reçu par QR Code",
        $note,
        'deposit',
        'Dépôt',
        'arrow-down',
        'rgba(16, 185, 129, 0.15)',
        '#10b981',
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
        'message' => "Dépôt de $amount FCFA enregistré avec succès sur le compte $recipientPhone",
        'newBalance' => $newBalance,
        'targetUserId' => $targetUserId,
        'transaction' => [
            'id' => $txRef,
            'title' => "Dépôt reçu par QR Code",
            'subtitle' => $note,
            'category' => 'deposit',
            'categoryLabel' => 'Dépôt',
            'icon' => 'arrow-down',
            'iconBg' => 'rgba(16, 185, 129, 0.15)',
            'iconColor' => '#10b981',
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
    jsonResponse(['success' => false, 'message' => 'Erreur lors du dépôt : ' . $e->getMessage()], 500);
}
