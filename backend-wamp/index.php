<?php
require_once __DIR__ . '/config.php';

jsonResponse([
    'success' => true,
    'status' => 'online',
    'app' => 'PayPulse Mobile Payment API',
    'version' => '1.0.0',
    'database' => $dbname,
    'server_time' => date('Y-m-d H:i:s'),
    'endpoints' => [
        'GET  /get_data.php' => 'Récupère le profil, le solde, la carte et les transactions',
        'POST /send_money.php' => 'Effectue un virement et met à jour le solde',
        'POST /top_up.php' => 'Recharge le compte et enregistre la transaction',
        'POST /sync.php' => 'Synchronisation bidirectionnelle données locales <-> WAMP'
    ]
]);
