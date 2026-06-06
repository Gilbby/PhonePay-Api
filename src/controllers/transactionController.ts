import { Response } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import User from '../models/User';
import Wallet from '../models/Wallet';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { initiateDeposit, getProvider } from '../services/pawapayService';

const generateReference = (): string => {
  return `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const getNetworkGroup = (phone: string): string => {
  const prefix = phone.replace(/^\+260/, '').substring(0, 2);
  if (['96', '76'].includes(prefix)) return 'MTN';
  if (['97', '77'].includes(prefix)) return 'AIRTEL';
  if (['95', '75'].includes(prefix)) return 'ZAMTEL';
  return 'UNKNOWN';
};

const isSameNetwork = (phone1: string, phone2: string): boolean => {
  return getNetworkGroup(phone1) === getNetworkGroup(phone2);
};

const PAWAPAY_RATE = 0.01; // 1% pawaPay fee

const calculateLevy = (amount: number): number => {
  if (amount <= 150)  return 0.32;
  if (amount <= 300)  return 0.40;
  if (amount <= 500)  return 0.80;
  if (amount <= 1000) return 2.00;
  if (amount <= 3000) return 4.00;
  if (amount <= 5000) return 7.50;
  return 8.00;
};

const snappayProfit = (amount: number, crossNetwork: boolean): number => {
  if (crossNetwork) {
    if (amount <= 50)   return 1.90;
    if (amount <= 100)  return 1.40;
    if (amount <= 200)  return 2.90;
    if (amount <= 500)  return 4.90;
    if (amount <= 1000) return 9.90;
    if (amount <= 3000) return 10.00;
    if (amount <= 5000) return 10.00;
    return 10.00;
  } else {
    return 1.00; // flat K1.00 profit on all same-network tiers
  }
};

// Total fee charged to the sender on top of the send amount
const calculateFee = (amount: number, crossNetwork: boolean): number => {
  const pawapay = amount * PAWAPAY_RATE;
  const levy = calculateLevy(amount);
  const profit = snappayProfit(amount, crossNetwork);
  return +(pawapay + levy + profit).toFixed(2);
};

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { type, limit = 20, page = 1 } = req.query;

    const filter: Record<string, unknown> = {
      $or: [
        { senderId: userId, type: { $in: ['sent', 'cash_out'] } },
        { receiverId: userId, type: 'received' },
      ],
    };

    if (type && type !== 'all') {
      filter.type = type;
    }

    const transactions = await Transaction.find(filter)
      .populate('senderId', 'name alias phone')
      .populate('receiverId', 'name alias phone')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const sendMoney = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientAlias, recipientPhone, amount, senderWalletId, pin } = req.body;
    const senderId = req.user!._id;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Valid amount is required' });
      return;
    }

    if (!pin) {
      res.status(400).json({ success: false, message: 'PIN is required.' });
      return;
    }

    const recipient = await User.findOne(
      recipientAlias ? { alias: recipientAlias } : { phone: recipientPhone }
    );

    if (!recipient) {
      res.status(404).json({ success: false, message: 'Recipient not found' });
      return;
    }

    if (recipient._id.toString() === senderId.toString()) {
      res.status(400).json({ success: false, message: 'Cannot send money to yourself' });
      return;
    }

    if (!senderWalletId || !mongoose.Types.ObjectId.isValid(senderWalletId)) {
      res.status(400).json({ success: false, message: 'Please add a wallet before sending money.' });
      return;
    }

    const senderWallet = await Wallet.findById(senderWalletId);
    if (!senderWallet) {
      res.status(400).json({ success: false, message: 'Sender wallet not found' });
      return;
    }

    try {
      getProvider(senderWallet.phone);
    } catch {
      res.status(400).json({ success: false, message: 'Wallet provider not supported' });
      return;
    }

    const userWithPin = await User.findById(senderId).select('+pin');
    if (!userWithPin?.pin) {
      res.status(400).json({ success: false, message: 'Please set up a PIN before sending money.' });
      return;
    }
    const pinValid = await userWithPin.comparePin(pin);
    if (!pinValid) {
      res.status(401).json({ success: false, message: 'Incorrect PIN.' });
      return;
    }

    if (amount > 10000) {
      res.status(400).json({ success: false, message: 'Maximum transaction amount is K10,000.' });
      return;
    }

    const cross = !isSameNetwork(senderWallet.phone, recipient.phone);
    const fee = calculateFee(amount, cross);
    const reference = generateReference();

    const transaction = await Transaction.create({
      type: 'sent',
      amount,
      fee,
      status: 'pending',
      senderId,
      receiverId: recipient._id,
      senderWalletId,
      reference,
    });

    const { depositId, data: depositData } = await initiateDeposit(
      senderWallet.phone,
      amount + fee
    );

    if (depositData.status !== 'ACCEPTED') {
      transaction.status = 'failed';
      await transaction.save();
      res.status(402).json({
        success: false,
        message: depositData.failureReason?.failureMessage || 'Deposit initiation failed',
      });
      return;
    }

    transaction.depositId = depositId;
    transaction.status = 'pending';
    await transaction.save();

    res.status(201).json({
      success: true,
      transaction,
      recipient: {
        name: recipient.alias,
        alias: recipient.alias,
      },
      fee,
      total: amount + fee,
      message: 'Payment initiated — confirm on your phone',
    });
  } catch (err) {
    console.error('sendMoney error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { agentCode, amount, walletId, pin } = req.body;
    const senderId = req.user!._id;

    if (!agentCode || !amount || amount <= 0 || !pin) {
      res.status(400).json({ success: false, message: 'Agent code, amount, and PIN are required.' });
      return;
    }

    const agent = await User.findOne({ agentCode, isAgent: true });
    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent not found' });
      return;
    }

    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      res.status(400).json({ success: false, message: 'Please add a wallet before withdrawing cash.' });
      return;
    }

    // Get sender's wallet for their phone number
    const senderWallet = await Wallet.findById(walletId);
    if (!senderWallet) {
      res.status(400).json({ success: false, message: 'Sender wallet not found' });
      return;
    }

    // Validate sender phone is supported
    try {
      getProvider(senderWallet.phone);
    } catch {
      res.status(400).json({ success: false, message: 'Wallet provider not supported' });
      return;
    }

    const userWithPin = await User.findById(senderId).select('+pin');
    if (!userWithPin?.pin) {
      res.status(400).json({ success: false, message: 'Please set up a PIN before withdrawing cash.' });
      return;
    }
    const pinValid = await userWithPin.comparePin(pin);
    if (!pinValid) {
      res.status(401).json({ success: false, message: 'Incorrect PIN.' });
      return;
    }

    const fee = calculateFee(amount, false);
    const reference = generateReference();

    const transaction = await Transaction.create({
      type: 'cash_out',
      amount,
      fee,
      status: 'pending',
      senderId,
      agentId: agent._id,
      senderWalletId: walletId,
      reference,
    });

    // Step 1 — Deposit from sender's mobile wallet into Snappay
    const { depositId, data: depositData } = await initiateDeposit(
      senderWallet.phone,
      amount + fee
    );

    if (depositData.status !== 'ACCEPTED') {
      transaction.status = 'failed';
      await transaction.save();
      res.status(402).json({
        success: false,
        message: depositData.failureReason?.failureMessage || 'Deposit initiation failed',
      });
      return;
    }

    transaction.depositId = depositId;
    transaction.status = 'pending';
    await transaction.save();

    res.status(201).json({
      success: true,
      transaction,
      agent: { name: agent.alias, code: agent.agentCode },
      fee,
      total: amount + fee,
      message: 'Cash out initiated — confirm on your phone',
    });
  } catch (err) {
    console.error('getCash error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};