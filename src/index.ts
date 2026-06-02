import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db';
import { startReconciliation } from './services/reconciliationService';
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallets';
import transactionRoutes from './routes/transactions';
import userRoutes from './routes/users';
import webhookRoutes from './routes/webhooks';

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3000', 10);

connectDB();
startReconciliation();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes); // ← moved before 404 and listen

// Health check
app.get('/health', (_, res) => {
  res.json({ success: true, message: 'Snappay API is running', env: process.env.NODE_ENV });
});

// 404 handler
app.use('*', (_, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Snappay API running on port ${PORT}`);
});

export default app;