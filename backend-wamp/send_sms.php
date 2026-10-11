<?php
require_once __DIR__ . '/config.php';

// Load Textbelt configuration if available
$textbeltConfig = [];
$configPath = __DIR__ . '/textbelt_config.php';
if (file_exists($configPath)) {
    require_once $configPath;
    $textbeltConfig = [
        'api_key' => $TEXTBELT_API_KEY ?? '',
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

    // Tentative d'envoi via Textbelt API (gratuit, jusqu'à 10 SMS/jour)
    $sentViaTextbelt = false;
    $apiKey = $textbeltConfig['api_key'] ?? '';

    if (!empty($apiKey)) {
        $messageBody = "Votre code PayPulse est : $otp";
        
        $textbeltUrl = 'https://textbelt.com/send';
        
        $postFields = [
            'phone' => '+' . $cleanPhone,
            'message' => $messageBody,
            'apikey' => $apiKey,
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $textbeltUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postFields),
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

        $data = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300 && !$curlError && $data && isset($data['success']) && $data['success'] === true) {
            $sentViaTextbelt = true;
        }
    }

    jsonResponse([
        'success' => true,
        'otp' => $otp,
        'phone' => $cleanPhone,
        'expires_at' => $expiresAt,
        'sent_via_textbelt' => $sentViaTextbelt,
        'message' => $sentViaTextbelt
            ? "Code OTP envoyé par SMS via Textbelt"
            : "Code OTP généré localement. SMS non envoyé (Textbelt non configuré).",
        'method' => $sentViaTextbelt ? 'textbelt_sms' : 'local'
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la génération du OTP : ' . $e->getMessage()
    ], 500);
}