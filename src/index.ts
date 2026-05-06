import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallets';
import transactionRoutes from './routes/transactions';
import userRoutes from './routes/users';
import webhookRoutes from './routes/webhooks';



dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Stricter limit for auth routes
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
app.use('/api/users', userRoutes);  // ← move it here

// Health check
app.get('/health', (_, res) => {
  res.json({ success: true, message: 'PhonePay API is running', env: process.env.NODE_ENV });
});

// 404 handler
app.use('*', (_, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PhonePay API running on port ${PORT}`);
});


app.use('/api/webhooks', webhookRoutes);

export default app;
