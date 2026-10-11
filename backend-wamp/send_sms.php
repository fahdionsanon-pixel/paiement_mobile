<?php
require_once __DIR__ . '/config.php';

// Load Twilio configuration if available
$twilioConfig = [];
$configPath = __DIR__ . '/twilio_config.php';
if (file_exists($configPath)) {
    require_once $configPath;
    $twilioConfig = [
        'account_sid' => $TWILIO_ACCOUNT_SID ?? '',
        'auth_token' => $TWILIO_AUTH_TOKEN ?? '',
        'from_number' => $TWILIO_FROM_NUMBER ?? '',
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

    // Tentative d'envoi via Twilio API (si configuré)
    $sentViaTwilio = false;
    $accountSid = $twilioConfig['account_sid'] ?? '';
    $authToken = $twilioConfig['auth_token'] ?? '';
    $fromNumber = $twilioConfig['from_number'] ?? '';

    if (!empty($accountSid) && !empty($authToken) && !empty($fromNumber)) {
        $messageBody = "Votre code PayPulse est : $otp";
        
        // Twilio API endpoint
        $twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/$accountSid/Messages.json";
        
        $postFields = [
            'To' => '+' . $cleanPhone,
            'From' => $fromNumber,
            'Body' => $messageBody,
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $twilioUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postFields),
            CURLOPT_USERPWD => "$accountSid:$authToken",
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && !$curlError) {
            $sentViaTwilio = true;
        }
    }

    jsonResponse([
        'success' => true,
        'otp' => $otp,
        'phone' => $cleanPhone,
        'expires_at' => $expiresAt,
        'sent_via_twilio' => $sentViaTwilio,
        'message' => $sentViaTwilio
            ? "Code OTP envoyé par SMS via Twilio"
            : "Code OTP généré localement. SMS non envoyé (Twilio non configuré).",
        'method' => $sentViaTwilio ? 'twilio_sms' : 'local'
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la génération du OTP : ' . $e->getMessage()
    ], 500);
}