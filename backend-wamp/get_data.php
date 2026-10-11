<?php
require_once __DIR__ . '/config.php';

try {
    $phone = isset($_GET['phone']) ? trim($_GET['phone']) : '';
    $user = null;
    $userId = 1;

    if (!empty($phone)) {
        $stmtUser = $pdo->prepare('SELECT * FROM users WHERE phone = ? LIMIT 1');
        $stmtUser->execute([$phone]);
        $user = $stmtUser->fetch();
        if ($user) {
            $userId = (int)$user['id'];
        }
    }

    if (!$user) {
        // Phone not found in database - return empty user data instead of falling back to user_id=1
        // This prevents account data from leaking between users
        jsonResponse([
            'success' => true,
            'user' => [
                'id' => 0,
                'name' => '',
                'phone' => $phone,
                'initials' => '',
                'verified' => false,
                'cashbackBalance' => 0,
            ],
            'balanceXOF' => 0,
            'card' => null,
            'contacts' => [],
            'savingsGoal' => null,
            'transactions' => [],
            'syncedAt' => date('Y-m-d H:i:s'),
        ]);
    }

    // 2. Carte virtuelle
    $stmtCard = $pdo->prepare('SELECT * FROM cards WHERE user_id = ? LIMIT 1');
    $stmtCard->execute([$userId]);
    $card = $stmtCard->fetch();

    // 3. Contacts
    $stmtContacts = $pdo->prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY id ASC');
    $stmtContacts->execute([$userId]);
    $contacts = $stmtContacts->fetchAll();

    // 4. Objectif d'épargne
    $stmtGoal = $pdo->prepare('SELECT * FROM savings_goals WHERE user_id = ? LIMIT 1');
    $stmtGoal->execute([$userId]);
    $goal = $stmtGoal->fetch();

    // 5. Transactions
    $stmtTx = $pdo->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $stmtTx->execute([$userId]);
    $rawTx = $stmtTx->fetchAll();

    $transactions = array_map(function($t) {
        return [
            'id' => $t['tx_reference'],
            'title' => $t['title'],
            'subtitle' => $t['subtitle'],
            'category' => $t['category'],
            'categoryLabel' => $t['category_label'],
            'icon' => $t['icon'],
            'iconBg' => $t['icon_bg'],
            'iconColor' => $t['icon_color'],
            'amount' => (float)$t['amount'],
            'type' => $t['type'],
            'date' => $t['date_label'],
            'time' => $t['time_label'],
            'status' => $t['status'],
            'reference' => $t['tx_reference'],
            'fees' => (float)$t['fees'],
        ];
    }, $rawTx);

    jsonResponse([
        'success' => true,
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'phone' => $user['phone'],
            'initials' => $user['initials'],
            'verified' => (bool)$user['verified'],
            'cashbackBalance' => (float)$user['cashback'],
        ],
        'balanceXOF' => (float)$user['balance'],
        'card' => $card ? [
            'cardNumber' => $card['card_number'],
            'cardHolder' => $card['card_holder'],
            'expiry' => $card['expiry'],
            'cvv' => $card['cvv'],
            'isFrozen' => (bool)$card['is_frozen'],
            'cardTier' => $card['card_tier'],
        ] : null,
        'contacts' => array_map(function($c) {
            return [
                'id' => (int)$c['id'],
                'name' => $c['name'],
                'phone' => $c['phone'],
                'initials' => $c['initials'],
                'color' => $c['color']
            ];
        }, $contacts),
        'savingsGoal' => $goal ? [
            'title' => $goal['title'],
            'current' => (float)$goal['current_amount'],
            'target' => (float)$goal['target_amount'],
            'percent' => (int)$goal['percent'],
        ] : null,
        'transactions' => $transactions,
        'syncedAt' => date('Y-m-d H:i:s'),
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la récupération des données : ' . $e->getMessage()
    ], 500);
}
