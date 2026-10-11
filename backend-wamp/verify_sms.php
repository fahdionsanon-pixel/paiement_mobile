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
    // Vérification locale (rapide et fiable)
    $stmt = $pdo->prepare('
        SELECT * FROM sms_otps
        WHERE phone = ? AND verified = 0
        ORDER BY created_at DESC
        LIMIT 1
    ');
    $stmt->execute([$cleanPhone]);
    $otpRecord = $stmt->fetch();

    $verified = false;

    if ($otpRecord) {
        // Vérifier l'expiration
        $now = new DateTime();
        $expiresAt = new DateTime($otpRecord['expires_at']);
        if ($now > $expiresAt) {
            $upd = $pdo->prepare('UPDATE sms_otps SET verified = -1 WHERE id = ?');
            $upd->execute([$otpRecord['id']]);
        } elseif ($otpRecord['otp'] === $code) {
            // Marquer comme vérifié
            $upd = $pdo->prepare('UPDATE sms_otps SET verified = 1 WHERE id = ?');
            $upd->execute([$otpRecord['id']]);
            $verified = true;
        }
    }

    if ($verified) {
        // Mettre à jour l'utilisateur dans la table users
        $stmtUser = $pdo->prepare('UPDATE users SET verified = 1 WHERE phone = ?');
        $stmtUser->execute([$cleanPhone]);

        jsonResponse([
            'success' => true,
            'message' => 'Authentification SMS réussie !',
            'phone' => $cleanPhone,
            'verified_at' => date('Y-m-d H:i:s')
        ]);
    }

    jsonResponse(['success' => false, 'message' => 'Code OTP incorrect ou expiré'], 400);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la vérification : ' . $e->getMessage()
    ], 500);
}