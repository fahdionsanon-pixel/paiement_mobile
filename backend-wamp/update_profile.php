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
    // Normalize phone for comparison AND storage
    $cleanPhone = preg_replace('/[^0-9]/', '', $phone);

    // Calculate initials
    $parts = explode(' ', $name);
    $initials = '';
    foreach ($parts as $p) {
        if (!empty($p)) {
            $initials .= mb_strtoupper(mb_substr($p, 0, 1));
        }
    }
    $initials = mb_substr($initials, 0, 3);

    // Vérifier si l'utilisateur existe déjà par numéro de téléphone (normalized comparison)
    $stmt = $pdo->prepare('SELECT id, phone FROM users WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, "+", ""), " ", ""), "-", ""), "(", "") = ? LIMIT 1');
    $stmt->execute([$cleanPhone]);
    $user = $stmt->fetch();

    if ($user) {
        $userId = (int)$user['id'];
        $upd = $pdo->prepare('UPDATE users SET name = ?, initials = ?, verified = 1, phone = ? WHERE id = ?');
        $upd->execute([$name, $initials, $cleanPhone, $userId]);
    } else {
        // Créer un nouvel utilisateur avec le numéro nettoyé
        $ins = $pdo->prepare('INSERT INTO users (name, phone, initials, balance, verified) VALUES (?, ?, ?, 0.00, 1)');
        $ins->execute([$name, $cleanPhone, $initials]);
        $userId = (int)$pdo->lastInsertId();
    }

    jsonResponse([
        'success' => true,
        'message' => 'Profil enregistré avec succès',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'phone' => $cleanPhone,
            'initials' => $initials,
            'verified' => true
        ]
    ]);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Erreur : ' . $e->getMessage()], 500);
}
