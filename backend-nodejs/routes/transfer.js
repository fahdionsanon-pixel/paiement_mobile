import { Router } from 'express';
import { getDb, generateReference, verifyPin } from '../database.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

router.post('/send', requireSession, (req, res) => {
  const db = getDb();
  const sender = req.user; // sender comes from session
  const { recipientPhone, amount, idempotency_key } = req.body;
  const pin = String(req.body.pin || '');

  // Validate inputs
  if (!recipientPhone || !amount || !pin || !idempotency_key) {
    return res.status(400).json({ success: false, message: 'Destinataire, montant, PIN et clé requis' });
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Le montant doit être un entier positif' });
  }

  const cleanRecipient = String(recipientPhone || '').replace(/[^0-9]/g, '');

  if (cleanRecipient === sender.phone) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous envoyer de l\'argent' });
  }

  const senderAccount = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(sender.id);
  if (!senderAccount) {
    return res.status(500).json({ success: false, message: 'Compte manquant' });
  }

  // Same key + same sender = same transaction: return result without redoing
  const existing = db
    .prepare('SELECT reference, amount FROM transactions WHERE idempotency_key = ? AND from_account_id = ?')
    .get(idempotency_key, senderAccount.id);
  if (existing) {
    return res.json({
      success: true,
      duplicate: true,
      transaction: { ...existing, sender_new_balance: senderAccount.balance },
    });
  }

  // Account locked after too many PIN attempts
  if (sender.locked_until && new Date(sender.locked_until) > new Date()) {
    return res.status(423).json({ success: false, message: 'Compte verrouillé, réessayez plus tard' });
  }

  if (!sender.pin_hash) {
    return res.status(400).json({ success: false, message: 'Définissez d\'abord votre PIN' });
  }

  if (!verifyPin(String(pin), sender.pin_hash)) {
    const attempts = sender.failed_pin_attempts + 1;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET failed_pin_attempts = 0, locked_until = ? WHERE id = ?').run(until, sender.id);
    } else {
      db.prepare('UPDATE users SET failed_pin_attempts = ? WHERE id = ?').run(attempts, sender.id);
    }
    return res.status(400).json({ success: false, message: 'PIN incorrect' });
  }

  // Reset failed attempts on success
  db.prepare('UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE id = ?').run(sender.id);

  const recipient = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanRecipient);
  if (!recipient) {
    return res.status(404).json({ success: false, message: 'Destinataire introuvable' });
  }

  const recipientAccount = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(recipient.id);
  if (!recipientAccount) {
    return res.status(500).json({ success: false, message: 'Compte du destinataire manquant' });
  }

  const reference = generateReference('TX');
  try {
    db.transaction(() => {
      const debit = db
        .prepare(`UPDATE accounts SET balance = balance - ?, updated_at = datetime('now') WHERE id = ? AND balance >= ?`)
        .run(amount, senderAccount.id, amount);
      if (debit.changes === 0) throw new Error('INSUFFICIENT_FUNDS');
      db.prepare(`UPDATE accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?`)
        .run(amount, recipientAccount.id);
      db.prepare(
        `INSERT INTO transactions (reference, idempotency_key, type, from_account_id, to_account_id, amount, status)
         VALUES (?, ?, 'transfer', ?, ?, ?, 'completed')`
      ).run(reference, idempotency_key, senderAccount.id, recipientAccount.id, amount);
    })();
  } catch (err) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ success: false, message: 'Solde insuffisant' });
    }
    console.error('Transfer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }

  const { balance } = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(senderAccount.id);

  res.json({
    success: true,
    message: 'Transfert effectué',
    transaction: { reference, amount, to: cleanRecipient, sender_new_balance: balance },
  });
});

export default router;