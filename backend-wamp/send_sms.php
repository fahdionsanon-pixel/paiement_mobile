<?php
require_once __DIR__ . '/config.php';

// Load otp.dev configuration if available
$otpConfig = [];
$configPath = __DIR__ . '/otp_config.php';
if (file_exists($configPath)) {
    require_once $configPath;
    $otpConfig = [
        'api_key' => $OTP_API_KEY ?? '',
        'template_id' => $OTP_TEMPLATE_ID ?? '',
        'sender' => $OTP_SENDER ?? 'PayPulse',
    ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Méthode POST requise'], 405);
}

$input = getJsonInput();
$phone = isset($input['phone']) ? trim($input['phone']) : '';

if (empty($phone)) {
    jsonResponse(['success' => false, 'message' => 'Numéro de téléphone requis'], 400);
}

// Nettoyer le numéro (enlever le + et les espaces)
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

    // Tentative d'envoi via otp.dev API (si configuré)
    $sentViaOtpDev = false;
    $apiApiKey = $otpConfig['api_key'] ?? '';
    $apiTemplateId = $otpConfig['template_id'] ?? '';
    $apiSender = $otpConfig['sender'] ?? 'PayPulse';

    if (!empty($apiApiKey) && !empty($apiTemplateId)) {
        $otpData = [
            'channel' => 'sms',
            'sender' => $apiSender,
            'phone' => $cleanPhone,
            'template' => $apiTemplateId,
            'code_length' => 6,
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://api.otp.dev/v1/verifications',
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['data' => $otpData]),
            CURLOPT_HTTPHEADER => [
                'X-OTP-Key: ' . $apiApiKey,
                'accept: application/json',
                'content-type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && !$curlError) {
            $sentViaOtpDev = true;
        }
    }

    jsonResponse([
        'success' => true,
        'otp' => $otp,
        'phone' => $cleanPhone,
        'expires_at' => $expiresAt,
        'sent_via_otp_dev' => $sentViaOtpDev,
        'message' => $sentViaOtpDev
            ? "Code OTP envoyé par SMS via otp.dev"
            : "Code OTP généré localement. SMS non envoyé (otp.dev non configuré).",
        'method' => $sentViaOtpDev ? 'otp_dev_sms' : 'local'
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la génération du OTP : ' . $e->getMessage()
    ], 500);
}