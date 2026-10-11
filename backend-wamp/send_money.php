<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
  $userId = isset($input['user_id']) ? (int)$input['user_id'] : 1;
  $phone = $input['phone'] ?? '';
  $amount = isset($input['amount']) ? (float)$input['amount'] : 0;
  $recipient = trim($input['recipient_name'] ?? ($input['recipient_phone'] ?? 'Destinataire'));
  $note = trim($input['note'] ?? 'Transfert instantané PayPulse');
  $category = trim($input['category'] ?? 'transfer');

  // Find the correct user ID from the phone number
  if (!empty($phone)) {
      $stmtFindUser = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
      $stmtFindUser->execute([$phone]);
      $foundUser = $stmtFindUser->fetch();
      if ($foundUser) {
          $userId = (int)$foundUser['id'];
      }
  }

if ($amount <= 0) {
    jsonResponse(['success' => false, 'message' => 'Montant invalide'], 400);
}

try {
    $pdo->beginTransaction();

    // Vérifier le solde de l'utilisateur
    $stmt = $pdo->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Utilisateur introuvable'], 404);
    }

    $currentBalance = (float)$user['balance'];
    if ($currentBalance < $amount) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'message' => 'Solde insuffisant dans la base de données WAMP'], 400);
    }

    $newBalance = $currentBalance - $amount;

    // Mettre à jour le solde
    $updateStmt = $pdo->prepare('UPDATE users SET balance = ? WHERE id = ?');
    $updateStmt->execute([$newBalance, $userId]);

    // Insérer la transaction avec une référence unique
    $txRef = 'TX-OUT-' . time() . '-' . rand(1000, 9999);
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
        "Transfert vers $recipient",
        $note,
        $category,
        'Transfert',
        'paper-plane',
        'rgba(99, 102, 241, 0.15)',
        '#6366f1',
        $amount,
        'debit',
        $dateLabel,
        $timeLabel,
        'completed',
        0.00
    ]);

    $pdo->commit();

    jsonResponse([
        'success' => true,
        'message' => 'Transfert enregistré avec succès dans MySQL WAMP',
        'newBalance' => $newBalance,
        'transaction' => [
            'id' => $txRef,
            'title' => "Transfert vers $recipient",
            'subtitle' => $note,
            'category' => $category,
            'categoryLabel' => 'Transfert',
            'icon' => 'paper-plane',
            'iconBg' => 'rgba(99, 102, 241, 0.15)',
            'iconColor' => '#6366f1',
            'amount' => $amount,
            'type' => 'debit',
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
        'message' => 'Erreur lors du transfert : ' . $e->getMessage()
    ], 500);
}
