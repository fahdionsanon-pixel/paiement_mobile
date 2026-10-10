<?php
// ===================================================
// PayPulse API - Configuration & Connexion Base de Données
// ===================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

// Répondre aux requêtes preflight OPTIONS d'Angular
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Paramètres de connexion MySQL WAMP
$host = '127.0.0.1';
$port = '3306';
$dbname = 'paiement_mobile_db';
$user = 'root';
$passwords = ['1234', '', 'root'];

$pdo = null;
$errorMsg = null;

foreach ($passwords as $pwd) {
    try {
        $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pwd, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        break; // Connexion réussie
    } catch (PDOException $e) {
        $errorMsg = $e->getMessage();
    }
}

if (!$pdo) {
    echo json_encode([
        'success' => false,
        'message' => 'Erreur de connexion à la base de données WampServer: ' . $errorMsg
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}
