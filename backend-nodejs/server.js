// PayPulse API Server
// Node.js + Express + better-sqlite3
// Architecture: 3 pièces - Base de données, API, App

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initDatabase, getDb } from './database.js';
import authRoutes from './routes/auth.js';
import otpRoutes from './routes/otp.js';
import pinRoutes from './routes/pin.js';
import transferRoutes from './routes/transfer.js';
import transactionRoutes from './routes/transactions.js';
import sessionRoutes from './routes/session.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PayPulse API', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/pin', pinRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/session', sessionRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Erreur serveur interne' });
});

// Initialize database and start server
await initDatabase();

app.listen(PORT, () => {
  console.log(`PayPulse API running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

export default app;