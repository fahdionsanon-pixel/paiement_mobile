<?php
require_once __DIR__ . '/config.php';

$input = getJsonInput();
$userId = isset($input['user_id']) ? (int)$input['user_id'] : 1;
$pendingTransactions = $input['pending_transactions'] ?? [];

try {
    $pdo->beginTransaction();

    if (!empty($pendingTransactions)) {
        $insTx = $pdo->prepare('
            INSERT IGNORE INTO transactions 
            (tx_reference, user_id, title, subtitle, category, category_label, icon, icon_bg, icon_color, amount, type, date_label, time_label, status, fees)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');

        foreach ($pendingTransactions as $tx) {
            $insTx->execute([
                $tx['reference'] ?? ('TX-SYNC-' . rand(100000, 999999)),
                $userId,
                $tx['title'],
                $tx['subtitle'] ?? '',
                $tx['category'] ?? 'transfer',
                $tx['categoryLabel'] ?? 'Opération',
                $tx['icon'] ?? 'cash',
                $tx['iconBg'] ?? 'rgba(99, 102, 241, 0.15)',
                $tx['iconColor'] ?? '#6366f1',
                (float)$tx['amount'],
                $tx['type'],
                $tx['date'] ?? 'Aujourd’hui',
                $tx['time'] ?? date('H:i'),
                $tx['status'] ?? 'completed',
                (float)($tx['fees'] ?? 0)
            ]);
        }
    }

    $pdo->commit();

    // Rediriger vers l'état le plus récent
    $_GET['user_id'] = $userId;
    require __DIR__ . '/get_data.php';

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la synchronisation : ' . $e->getMessage()
    ], 500);
}
