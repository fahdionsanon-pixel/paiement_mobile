// PIN Routes - Create and verify PIN with attempt counter and lockout

import { Router } from 'express';
import { getDb, hashPin, verifyPin } from '../database.js';

const router = Router();

// Set PIN (after OTP verification)
router.post('/set', (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: 'Phone et PIN requis' });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'Le PIN doit être à 4 chiffres' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const pinHash = hashPin(pin);
    db.prepare('UPDATE users SET pin_hash = ?, failed_pin_attempts = 0, locked_until = NULL WHERE id = ?')
      .run(pinHash, user.id);

    res.json({ success: true, message: 'PIN enregistré avec succès' });
  } catch (err) {
    console.error('PIN set error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Verify PIN (for transfer authorization)
router.post('/verify', (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: 'Phone et PIN requis' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    // Check if locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Compte verrouillé. Réessayez dans ${remaining} minute(s).`
      });
    }

    // Verify PIN
    const valid = verifyPin(pin, user.pin_hash);
    if (!valid) {
      const attempts = user.failed_pin_attempts + 1;
      let lockedUntil = null;
      if (attempts >= 3) {
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min lockout
      }
      db.prepare('UPDATE users SET failed_pin_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockedUntil, user.id);
      
      const remaining = 3 - attempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0 
          ? `PIN incorrect. ${remaining} tentative(s) restante(s).`
          : 'Trop de tentatives. Compte verrouillé 30 minutes.'
      });
    }

    // Reset attempts on success
    db.prepare('UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    res.json({ success: true, message: 'PIN vérifié' });
  } catch (err) {
    console.error('PIN verify error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;