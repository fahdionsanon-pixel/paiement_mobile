import { Router } from 'express';
import { getDb, verifyToken, generateToken, hashToken } from '../database.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();

router.get('/validate', requireSession, (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    user: { id: u.id, phone: u.phone, name: u.name },
    hasPin: !!u.pin_hash,
  });
});

router.post('/revoke', requireSession, (req, res) => {
  getDb()
    .prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
    .run(req.user.id);
  res.json({ success: true, message: 'Déconnecté' });
});

// Refresh token - extend session expiry
router.post('/refresh', requireSession, (req, res) => {
  const db = getDb();
  const user = req.user;
  const oldTokenHash = req.tokenHash; // from requireSession middleware

  // Generate new token
  const newToken = generateToken();
  const newTokenHash = hashToken(newToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Revoke old session, create new one
  db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND token_hash = ?`)
    .run(user.id, oldTokenHash);
  db.prepare('INSERT INTO sessions (user_id, token_hash, device_name, expires_at) VALUES (?, ?, ?, ?)')
    .run(user.id, newTokenHash, 'Appareil Ionic', expiresAt);

  res.json({
    success: true,
    message: 'Session rafraîchie',
    token: newToken,
    expires_at: expiresAt,
  });
});

export default router;