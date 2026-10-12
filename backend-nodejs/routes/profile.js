import { Router } from 'express';
import { getDb } from '../database.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();

router.post('/', requireSession, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ success: false, message: 'Nom invalide' });
  }
  getDb().prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ success: true, user: { id: req.user.id, phone: req.user.phone, name } });
});

export default router;