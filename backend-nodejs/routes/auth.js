// Auth Routes - User authentication

import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

// Login with phone
router.post('/login', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone requis' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvé' });
    }

    const account = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(user.id);

    res.json({
      success: true,
      user: { id: user.id, phone: user.phone, name: user.name },
      balance: account.balance,
      currency: account.currency
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;