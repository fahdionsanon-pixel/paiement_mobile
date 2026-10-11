// Session Routes - Manage user sessions with token

import { Router } from 'express';
import { getDb, generateToken, hashToken } from '../database.js';

const router = Router();

// Create session (after OTP + PIN)
router.post('/create', (req, res) => {
  try {
    const { phone, deviceName } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone requis' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    // Revoke old sessions
    db.prepare('UPDATE sessions SET revoked_at = datetime("now") WHERE user_id = ? AND revoked_at IS NULL')
      .run(user.id);

    // Create new session (7 days)
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (user_id, token_hash, device_name, expires_at) VALUES (?, ?, ?, ?)')
      .run(user.id, tokenHash, deviceName || 'Unknown', expiresAt);

    res.json({
      success: true,
      token,
      expires_at: expiresAt,
      user: { id: user.id, phone: user.phone, name: user.name }
    });
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Validate session
router.get('/validate', (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const db = getDb();
    
    // Find active sessions
    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE revoked_at IS NULL AND expires_at > datetime("now")'
    ).all();

    for (const session of sessions) {
      if (require('../database.js').verifyToken(token, session.token_hash)) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
        const account = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(user.id);
        return res.json({
          success: true,
          user: { id: user.id, phone: user.phone, name: user.name },
          balance: account.balance,
          currency: account.currency
        });
      }
    }

    res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  } catch (err) {
    console.error('Session validate error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Logout
router.post('/revoke', (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token manquant' });
    }

    const db = getDb();
    const sessions = db.prepare('SELECT * FROM sessions WHERE revoked_at IS NULL').all();
    
    for (const session of sessions) {
      if (require('../database.js').verifyToken(token, session.token_hash)) {
        db.prepare('UPDATE sessions SET revoked_at = datetime("now") WHERE id = ?').run(session.id);
        return res.json({ success: true, message: 'Déconnecté' });
      }
    }

    res.status(401).json({ success: false, message: 'Token invalide' });
  } catch (err) {
    console.error('Session revoke error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;