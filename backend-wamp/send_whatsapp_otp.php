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

// Nettoyer le numéro (enlever le + et les espaces)
$cleanPhone = preg_replace('/[^0-9]/', '', $phone);

// Générer un OTP à 6 chiffres
$otp = str_pad((string)rand(100000, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

try {
    // Supprimer les anciens OTPs pour ce numéro
    $delStmt = $pdo->prepare('DELETE FROM whatsapp_otps WHERE phone = ?');
    $delStmt->execute([$cleanPhone]);

    // Insérer le nouvel OTP
    $insStmt = $pdo->prepare('
        INSERT INTO whatsapp_otps (phone, otp, expires_at, verified)
        VALUES (?, ?, ?, 0)
    ');
    $insStmt->execute([$cleanPhone, $otp, $expiresAt]);

    // Tentative d'envoi via Meta Business API (si configuré)
    $sentViaMeta = false;
    $whatsappLink = '';

    // Configuration Meta Business API (à remplir avec vos vrais credentials)
    $metaAccessToken = ''; // TODO: Ajouter votre Meta Access Token
    $metaPhoneId = '';     // TODO: Ajouter votre Phone Number ID

    if (!empty($metaAccessToken) && !empty($metaPhoneId)) {
        $messageBody = "Votre code PayPulse est : $otp";
        $metaData = [
            'messaging_product' => 'whatsapp',
            'to' => $cleanPhone,
            'text' => ['body' => $messageBody]
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => "https://graph.facebook.com/v18.0/$metaPhoneId/messages",
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($metaData),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $metaAccessToken,
                'Content-Type: application/json'
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && !$curlError) {
            $sentViaMeta = true;
        }
    }

    // Générer un lien WhatsApp direct (fallback)
    $whatsappMessage = "Votre code PayPulse est : $otp";
    $whatsappLink = "https://api.whatsapp.com/send?phone=$cleanPhone&text=" . urlencode($whatsappMessage);

    jsonResponse([
        'success' => true,
        'otp' => $otp,
        'phone' => $cleanPhone,
        'expires_at' => $expiresAt,
        'whatsapp_link' => $whatsappLink,
        'sent_via_meta' => $sentViaMeta,
        'message' => $sentViaMeta
            ? "Code OTP envoyé via WhatsApp (Meta API)"
            : "Code OTP généré. Lien WhatsApp : $whatsappLink",
        'method' => $sentViaMeta ? 'meta_api' : 'whatsapp_link'
    ]);

} catch (Exception $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Erreur lors de la génération du OTP : ' . $e->getMessage()
    ], 500);
}