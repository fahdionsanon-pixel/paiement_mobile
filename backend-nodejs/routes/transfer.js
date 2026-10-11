// Transfer Routes - Atomic money transfer with idempotency
// The server decides everything: balance, PIN, recipient existence

import { Router } from 'express';
import { getDb, generateReference, generateIdempotencyKey, verifyPin } from '../database.js';

const router = Router();

// Transfer money - atomic transaction
router.post('/send', (req, res) => {
  try {
    const { phone, recipientPhone, amount, pin, idempotency_key } = req.body;

    // Validate inputs
    if (!phone || !recipientPhone || !amount || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: phone, recipientPhone, amount, pin'
      });
    }

    if (amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ success: false, message: 'Montant doit être un entier positif' });
    }

    const db = getDb();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanRecipient = recipientPhone.replace(/[^0-9]/g, '');

    // Check idempotency
    const idemKey = idempotency_key || generateIdempotencyKey();
    const existing = db.prepare('SELECT * FROM transactions WHERE idempotency_key = ?').get(idemKey);
    if (existing) {
      return res.json({
        success: true,
        message: 'Envoi déjà traité (idempotence)',
        transaction: existing,
        duplicate: true
      });
    }

    // Find sender
    const sender = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    if (!sender) {
      return res.status(404).json({ success: false, message: 'Expéditeur introuvable' });
    }

    // Check PIN
    if (!verifyPin(pin, sender.pin_hash)) {
      db.prepare('UPDATE users SET failed_pin_attempts = failed_pin_attempts + 1 WHERE id = ?').run(sender.id);
      return res.status(400).json({ success: false, message: 'PIN incorrect' });
    }

    // Find recipient
    const recipient = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanRecipient);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Destinataire introuvé' });
    }

    // Find accounts
    const senderAccount = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(sender.id);
    const recipientAccount = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(recipient.id);

    if (!senderAccount || !recipientAccount) {
      return res.status(500).json({ success: false, message: 'Compte manquant' });
    }

    // Check balance (server-side check)
    if (senderAccount.balance < amount) {
      return res.status(400).json({ success: false, message: 'Solde insuffisant' });
    }

    // Atomic transaction
    const reference = generateReference('TX');
    const tx = db.transaction(() => {
      // Debit sender
      const debitResult = db.prepare(
        'UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?'
      ).run(amount, senderAccount.id, amount);
      
      if (debitResult.changes === 0) {
        throw new Error('Solde insuffisant');
      }

      // Credit recipient
      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?')
        .run(amount, recipientAccount.id);

      // Insert transaction record
      db.prepare(
        `INSERT INTO transactions 
        (reference, idempotency_key, type, from_account_id, to_account_id, amount, status)
        VALUES (?, ?, 'transfer', ?, ?, ?, 'completed')`
      ).run(reference, idemKey, senderAccount.id, recipientAccount.id, amount);

      return reference;
    });

    const ref = tx();

    // Get updated balances
    const newSenderBalance = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(senderAccount.id).balance;
    const newRecipientBalance = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(recipientAccount.id).balance;

    res.json({
      success: true,
      message: 'Transfert effectué',
      transaction: {
        reference: ref,
        idempotency_key: idemKey,
        amount,
        from: cleanPhone,
        to: cleanRecipient,
        sender_new_balance: newSenderBalance,
        recipient_new_balance: newRecipientBalance
      }
    });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur: ' + err.message });
  }
});

export default router;