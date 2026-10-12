import { Router } from 'express';
import { getDb, hashPin } from '../database.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();

// Set PIN (requires session)
router.post('/set', requireSession, (req, res) => {
  const pin = String(req.body.pin || '');
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ success: false, message: 'Le PIN doit être à 4 chiffres' });
  }

  if (req.user.pin_hash) {
    return res.status(409).json({ success: false, message: 'Un PIN existe déjà' });
  }

  getDb()
    .prepare('UPDATE users SET pin_hash = ?, failed_pin_attempts = 0, locked_until = NULL WHERE id = ?')
    .run(hashPin(pin), req.user.id);

  res.json({ success: true, message: 'PIN enregistré' });
});

export default router;