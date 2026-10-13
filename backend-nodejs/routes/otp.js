// OTP Routes - Generate and verify OTP codes
// OTP is generated server-side, never in the app

import { Router } from 'express';
import { getDb, generateReference, generateToken, hashToken } from '../database.js';
import bcrypt from 'bcrypt';

const router = Router();

// Generate OTP (simulated - displays in response for testing)
router.post('/send', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = bcrypt.hashSync(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete old OTPs for this phone
    db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(cleanPhone);

    // Insert new OTP
    db.prepare('INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES (?, ?, ?)')
      .run(cleanPhone, codeHash, expiresAt);

    // Return OTP for testing (in production, this would be sent via SMS)
    res.json({
      success: true,
      otp: code,
      phone: cleanPhone,
      expires_at: expiresAt,
      message: 'OTP généré avec succès',
      method: 'simulated'
    });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Verify OTP
router.post('/verify', (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone et code requis' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const trimmedCode = code.trim();

    // Find latest OTP for this phone
    const otpRecord = db.prepare(
      'SELECT * FROM otp_codes WHERE phone = ? ORDER BY created_at DESC LIMIT 1'
    ).get(cleanPhone);

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Aucun OTP actif pour ce numéro' });
    }

    // Check expiration
    if (new Date() > new Date(otpRecord.expires_at)) {
      db.prepare('DELETE FROM otp_codes WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({ success: false, message: 'OTP expiré' });
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      db.prepare('DELETE FROM otp_codes WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({ success: false, message: 'Trop de tentatives' });
    }

     // Verify code
     const valid = bcrypt.compareSync(trimmedCode, otpRecord.code_hash);
     if (!valid) {
       db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
       return res.status(400).json({ success: false, message: 'Code incorrect' });
     }

     // Mark as used
     db.prepare('UPDATE otp_codes SET used_at = datetime(\'now\') WHERE id = ?').run(otpRecord.id);

     // Find or create user with transaction
     const findOrCreateUser = db.transaction(() => {
       let u = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
       if (!u) {
         const result = db.prepare('INSERT INTO users (phone, name) VALUES (?, ?)').run(cleanPhone, '');
         u = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
         db.prepare('INSERT INTO accounts (user_id, balance, currency) VALUES (?, ?, ?)').run(u.id, 0, 'XOF');
       }
       return u;
     });
     const user = findOrCreateUser();

     // Revoke existing sessions and create new one
     db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE user_id = ? AND revoked_at IS NULL')
       .run(user.id);

     const token = generateToken();
     const tokenHash = hashToken(token);
     const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

     db.prepare('INSERT INTO sessions (user_id, token_hash, device_name, expires_at) VALUES (?, ?, ?, ?)')
       .run(user.id, tokenHash, 'Appareil Ionic', expiresAt);

     res.json({
       success: true,
       message: 'OTP vérifié avec succès',
       token,
       expires_at: expiresAt,
       user: { id: user.id, phone: user.phone, name: user.name },
       hasPin: !!user.pin_hash,
     });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;