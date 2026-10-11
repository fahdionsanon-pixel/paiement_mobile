// Transaction Routes - List and get transaction details

import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

// List transactions for a user
router.get('/list', (req, res) => {
  try {
    const phone = req.query.phone;
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
    if (!account) {
      return res.status(500).json({ success: false, message: 'Compte manquant' });
    }

    // Get transactions where user is sender or recipient
    const transactions = db.prepare(`
      SELECT t.*, 
        u_from.phone as from_phone,
        u_to.phone as to_phone
      FROM transactions t
      LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
      LEFT JOIN accounts a_to ON t.to_account_id = a_to.id
      LEFT JOIN users u_from ON a_from.user_id = u_from.id
      LEFT JOIN users u_to ON a_to.user_id = u_to.id
      WHERE t.from_account_id = ? OR t.to_account_id = ?
      ORDER BY t.created_at DESC
      LIMIT 50
    `).all(account.id, account.id);

    const formatted = transactions.map(t => ({
      id: t.id,
      reference: t.reference,
      type: t.type,
      amount: t.amount,
      status: t.status,
      created_at: t.created_at,
      from_phone: t.from_phone,
      to_phone: t.to_phone,
      is_sender: t.from_account_id === account.id
    }));

    res.json({
      success: true,
      balance: account.balance,
      currency: account.currency,
      transactions: formatted
    });
  } catch (err) {
    console.error('Transaction list error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get single transaction
router.get('/:reference', (req, res) => {
  try {
    const { reference } = req.params;
    const db = getDb();

    const tx = db.prepare('SELECT * FROM transactions WHERE reference = ?').get(reference);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction introuvé' });
    }

    res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error('Transaction detail error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;