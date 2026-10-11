<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$phone = isset($input['phone']) ? trim($input['phone']) : '';
$code = isset($input['code']) ? trim($input['code']) : '';

if (empty($phone)) {
    jsonResponse(['success' => false, 'message' => 'Numéro de téléphone requis'], 400);
}

if (empty($code)) {
    jsonResponse(['success' => false, 'message' => 'Code OTP requis'], 400);
}

// Nettoyer le numéro
$cleanPhone = preg_replace('/[^0-9]/', '', $phone);

try {
    // Récupérer l'OTP stocké
    $stmt = $pdo->prepare('
        SELECT * FROM whatsapp_otps
        WHERE phone = ? AND verified = 0
        ORDER BY created_at DESC
        LIMIT 1
    ');
    $stmt->execute([$cleanPhone]);
    $otpRecord = $stmt->fetch();

    if (!$otpRecord) {
        jsonResponse(['success' => false, 'message' => 'Aucun OTP actif pour ce numéro'], 400);
    }

    // Vérifier l'expiration
    $now = new DateTime();
    $expiresAt = new DateTime($otpRecord['expires_at']);
    if ($now > $expiresAt) {
        // Marquer comme expiré
        $upd = $pdo->prepare('UPDATE whatsapp_otps SET verified = -1 WHERE id = ?');
        $upd->execute([$otpRecord['id']]);
        jsonResponse(['success' => false, 'message' => 'Le code OTP a expiré. Veuillez demander un nouveau code.'], 400);
    }

    // Vérifier le code
    if ($otpRecord['otp'] !== $code) {
        jsonResponse(['success' => false, 'message' => 'Code OTP incorrect'], 400);
    }

    // Marquer comme vérifié
    $upd = $pdo->prepare('UPDATE whatsapp_otps SET verified = 1 WHERE id = ?');
    $upd->execute([$otpRecord['id']]);

    // Mettre à jour l'utilisateur dans la table users (si il existe)
    $stmtUser = $pdo->prepare('UPDATE users SET verified = 1 WHERE phone = ?');
    $stmtUser->execute([$cleanPhone]);

    jsonResponse([
        'success' => true,
        'message' => 'Authentification WhatsApp réussie !',
        'phone' => $cleanPhone,
        'verified_at' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la vérification : ' . $e->getMessage()
    ], 500);
}