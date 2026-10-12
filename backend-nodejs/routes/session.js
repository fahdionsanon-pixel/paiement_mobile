import { Router } from 'express';
import { getDb, verifyToken } from '../database.js';
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

export default router;