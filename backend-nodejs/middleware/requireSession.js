// Middleware: Require valid session
import { getDb, verifyToken } from '../database.js';

export function requireSession(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Non connecté' });
  }

  const db = getDb();
  const sessions = db
    .prepare('SELECT * FROM sessions WHERE revoked_at IS NULL AND expires_at > ?')
    .all(new Date().toISOString());

  for (const s of sessions) {
    if (verifyToken(token, s.token_hash)) {
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id);
      req.tokenHash = s.token_hash; // expose for refresh endpoint
      return next();
    }
  }

  res.status(401).json({ success: false, message: 'Session invalide ou expirée' });
}