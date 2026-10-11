<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$phone = trim($input['phone'] ?? '');
$name = trim($input['name'] ?? '');

if (empty($phone)) {
    jsonResponse(['success' => false, 'message' => 'Numéro de téléphone requis'], 400);
}

if (empty($name)) {
    jsonResponse(['success' => false, 'message' => 'Nom requis'], 400);
}

try {
    // Calculer les initiales
    $parts = explode(' ', $name);
    $initials = '';
    foreach ($parts as $p) {
        if (!empty($p)) {
            $initials .= mb_strtoupper(mb_substr($p, 0, 1));
        }
    }
    $initials = mb_substr($initials, 0, 3);

    // Vérifier si l'utilisateur existe déjà par numéro de téléphone
    $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $stmt->execute([$phone]);
    $user = $stmt->fetch();

    if ($user) {
        $userId = (int)$user['id'];
        $upd = $pdo->prepare('UPDATE users SET name = ?, initials = ?, verified = 1 WHERE id = ?');
        $upd->execute([$name, $initials, $userId]);
    } else {
        // Create a new user with this phone number (don't reuse user_id=1)
        $ins = $pdo->prepare('INSERT INTO users (name, phone, initials, balance, verified) VALUES (?, ?, ?, 0.00, 1)');
        $ins->execute([$name, $phone, $initials]);
        $userId = (int)$pdo->lastInsertId();
    }

    jsonResponse([
        'success' => true,
        'message' => 'Profil enregistré avec succès',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'phone' => $phone,
            'initials' => $initials,
            'verified' => true
        ]
    ]);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Erreur : ' . $e->getMessage()], 500);
}
