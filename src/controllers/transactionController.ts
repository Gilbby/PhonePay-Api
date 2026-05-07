import { Response } from 'express';
import Transaction from '../models/Transaction';
import User from '../models/User';
import Wallet from '../models/Wallet';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { initiateDeposit, initiatePayout, getProvider } from '../services/pawapayService';

const generateReference = (): string => {
  return `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const calculateFee = (amount: number): number => {
  if (amount <= 100) return 2;
  if (amount <= 500) return 5;
  if (amount <= 1000) return 10;
  return 15;
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
    const { recipientAlias, recipientPhone, amount, senderWalletId } = req.body;
    const senderId = req.user!._id;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Valid amount is required' });
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

    const fee = calculateFee(amount);
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

    const recipientWallet = await Wallet.findOne({ userId: recipient._id, isPrimary: true });
    if (!recipientWallet) {
      transaction.status = 'failed';
      await transaction.save();
      res.status(404).json({ success: false, message: 'Recipient has no primary wallet' });
      return;
    }

    const { payoutId, data: payoutData } = await initiatePayout(
      recipientWallet.phone,
      amount
    );

    if (payoutData.status !== 'ACCEPTED') {
      transaction.status = 'failed';
      await transaction.save();
      res.status(402).json({
        success: false,
        message: payoutData.failureReason?.failureMessage || 'Payout initiation failed',
      });
      return;
    }

    transaction.reference = depositId;
    await transaction.save();

    await Transaction.create({
      type: 'received',
      amount,
      fee: 0,
      status: 'pending',
      senderId,
      receiverId: recipient._id,
      reference: payoutId,
    });

    res.status(201).json({
      success: true,
      transaction,
      recipient: {
        name: recipient.alias,
        alias: recipient.alias,
      },
      fee,
      total: amount + fee,
      message: 'Payment initiated — awaiting confirmation',
    });
  } catch (err) {
    console.error('sendMoney error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { agentCode, amount, walletId } = req.body;
    const senderId = req.user!._id;

    if (!agentCode || !amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Agent code and valid amount are required' });
      return;
    }

    const agent = await User.findOne({ agentCode, isAgent: true });
    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent not found' });
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

    // Get agent's primary wallet for payout
    const agentWallet = await Wallet.findOne({ userId: agent._id, isPrimary: true });
    if (!agentWallet) {
      res.status(404).json({ success: false, message: 'Agent has no primary wallet' });
      return;
    }

    const fee = calculateFee(amount);
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

    // Step 1 — Deposit from sender's mobile wallet into PhonePay
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

    // Step 2 — Payout to agent's primary wallet
    const { payoutId, data: payoutData } = await initiatePayout(
      agentWallet.phone,
      amount
    );

    if (payoutData.status !== 'ACCEPTED') {
      transaction.status = 'failed';
      await transaction.save();
      res.status(402).json({
        success: false,
        message: payoutData.failureReason?.failureMessage || 'Payout to agent failed',
      });
      return;
    }

    // Both accepted — update reference to depositId for webhook tracking
    transaction.reference = depositId;
    await transaction.save();

    res.status(201).json({
      success: true,
      transaction,
      agent: { name: agent.alias, code: agent.agentCode },
      fee,
      total: amount + fee,
      payoutReference: payoutId,
      message: 'Cash out initiated — awaiting confirmation',
    });
  } catch (err) {
    console.error('getCash error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};