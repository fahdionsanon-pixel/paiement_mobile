// Database module - SQLite with better-sqlite3
// Tables: users, accounts, transactions, otp_codes, sessions
// The database is the single source of truth

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'paypulse.db');

let db = null;

export function initDatabase() {
  db = new Database(DB_PATH);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      pin_hash TEXT DEFAULT '',
      failed_pin_attempts INTEGER DEFAULT 0,
      locked_until TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 2. Accounts table - balance is integer (smallest currency unit)
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK (balance >= 0)
    )
  `);

  // 3. Transactions table - append-only journal
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('transfer', 'deposit', 'withdraw')),
      from_account_id INTEGER,
      to_account_id INTEGER,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (from_account_id) REFERENCES accounts(id),
      FOREIGN KEY (to_account_id) REFERENCES accounts(id)
    )
  `);

  // 4. OTP codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      used_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 5. Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      device_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      revoked_at TEXT DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(reference)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_idemp ON transactions(idempotency_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)`);

  // Seed test data if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    seedTestData();
  }

  console.log('Database initialized successfully');
}

function seedTestData() {
  const insertUser = db.prepare('INSERT INTO users (phone, name) VALUES (?, ?)');
  const insertAccount = db.prepare('INSERT INTO accounts (user_id, balance, currency) VALUES (?, ?, ?)');
  const insertOtp = db.prepare('INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES (?, ?, ?)');

   // Test users with hashed PINs
   const testPinHash = bcrypt.hashSync('1234', 10);

   // User 1
   const user1 = insertUser.run('+22670123456', 'Amadou Diallo');
   insertAccount.run(user1.lastInsertRowid, 100000, 'XOF');
   db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(testPinHash, user1.lastInsertRowid);

   // User 2
   const user2 = insertUser.run('+226709876543', 'Fatou Beye');
   insertAccount.run(user2.lastInsertRowid, 50000, 'XOF');
   db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(testPinHash, user2.lastInsertRowid);

   // User 3
   const user3 = insertUser.run('+226705555555', 'Test Account');
   insertAccount.run(user3.lastInsertRowid, 0, 'XOF');
   db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(testPinHash, user3.lastInsertRowid);

  console.log('Test data seeded: 3 users with accounts');
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// Helper: generate unique reference
export function generateReference(prefix = 'TX') {
  return `${prefix}-${Date.now().toString(36)}-${uuidv4().substring(0, 8)}`;
}

// Helper: generate idempotency key
export function generateIdempotencyKey() {
  return `idem-${uuidv4()}`;
}

// Helper: hash PIN
export function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

// Helper: verify PIN
export function verifyPin(pin, hash) {
  return bcrypt.compareSync(pin, hash);
}

// Helper: generate session token
export function generateToken() {
  return `tok-${uuidv4()}-${Date.now().toString(36)}`;
}

// Helper: hash token for storage
export function hashToken(token) {
  return bcrypt.hashSync(token, 10);
}

// Helper: verify token
export function verifyToken(token, hash) {
  return bcrypt.compareSync(token, hash);
}

export default { initDatabase, getDb, generateReference, generateIdempotencyKey, hashPin, verifyPin, generateToken, hashToken, verifyToken };