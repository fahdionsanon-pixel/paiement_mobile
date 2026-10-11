<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$phone = isset($input['phone']) ? trim($input['phone']) : '';

if (empty($phone)) {
    jsonResponse(['success' => false, 'message' => 'Numéro de téléphone requis'], 400);
}

// Nettoyer le numéro
$cleanPhone = preg_replace('/[^0-9]/', '', $phone);

// Générer un OTP à 6 chiffres
$otp = str_pad((string)rand(100000, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

try {
    // Supprimer les anciens OTPs pour ce numéro
    $delStmt = $pdo->prepare('DELETE FROM sms_otps WHERE phone = ?');
    $delStmt->execute([$cleanPhone]);

    // Insérer le nouvel OTP dans la base locale
    $insStmt = $pdo->prepare('
        INSERT INTO sms_otps (phone, otp, expires_at, verified)
        VALUES (?, ?, ?, 0)
    ');
    $insStmt->execute([$cleanPhone, $otp, $expiresAt]);

    jsonResponse([
        'success' => true,
        'otp' => $otp,
        'phone' => $cleanPhone,
        'expires_at' => $expiresAt,
        'sent_via_sms' => false,
        'message' => "Code OTP généré : $otp",
        'method' => 'local'
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur : ' . $e->getMessage()
    ], 500);
}