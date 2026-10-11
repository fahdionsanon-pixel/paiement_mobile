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

    // Tentative d'envoi via Textbelt API (optionnel, uniquement si configuré)
    $sentViaSms = false;
    $configPath = __DIR__ . '/textbelt_config.php';
    if (file_exists($configPath)) {
        require_once $configPath;
        $apiKey = $TEXTBELT_API_KEY ?? '';
        if (!empty($apiKey)) {
            $messageBody = "Votre code PayPulse est : $otp";
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => 'https://textbelt.com/send',
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query([
                    'phone' => '+' . $cleanPhone,
                    'message' => $messageBody,
                    'apikey' => $apiKey,
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            $data = json_decode($response, true);
            if ($httpCode >= 200 && $httpCode < 300 && !$curlError && $data && isset($data['success']) && $data['success'] === true) {
                $sentViaSms = true;
            }
        }
    }

    jsonResponse([
        'success' => true,
        'otp' => $otp,
        'phone' => $cleanPhone,
        'expires_at' => $expiresAt,
        'sent_via_sms' => $sentViaSms,
        'message' => $sentViaSms
            ? "Code OTP envoyé par SMS via Textbelt"
            : "Code OTP généré : $otp",
        'method' => $sentViaSms ? 'textbelt_sms' : 'local'
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur : ' . $e->getMessage()
    ], 500);
}