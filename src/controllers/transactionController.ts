import { Response } from 'express';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

// Generate unique transaction reference
const generateReference = (): string => {
  return `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

// Calculate fee — matches frontend calculateFee util
const calculateFee = (amount: number): number => {
  if (amount <= 100) return 2;
  if (amount <= 500) return 5;
  if (amount <= 1000) return 10;
  return 15;
};

// @route   GET /api/transactions
// @desc    Get transaction history for current user
// @access  Private
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { type, limit = 20, page = 1 } = req.query;

    const filter: Record<string, unknown> = {
      $or: [{ senderId: userId }, { receiverId: userId }],
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

// @route   POST /api/transactions/send
// @desc    Initiate a send money transaction
// @access  Private
export const sendMoney = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientAlias, recipientPhone, amount, senderWalletId } = req.body;
    const senderId = req.user!._id;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Valid amount is required' });
      return;
    }

    // Find recipient by alias or phone
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

    const fee = calculateFee(amount);
    const reference = generateReference();

    // Create transaction as pending
    // NOTE: pawaPay deposit + payout will be triggered here in Phase 3
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

    // TODO Phase 3: Trigger pawaPay deposit here
    // On webhook confirmation: update status to 'success' and trigger payout

    // For now simulate success
    transaction.status = 'success';
    await transaction.save();

    // Create corresponding received transaction for recipient
    await Transaction.create({
      type: 'received',
      amount,
      fee: 0,
      status: 'success',
      senderId,
      receiverId: recipient._id,
      reference: `${reference}-R`,
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
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/transactions/cash-out
// @desc    Initiate a Get Cash (cash out via agent) transaction
// @access  Private
export const getCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { agentCode, amount, walletId } = req.body;
    const senderId = req.user!._id;

    if (!agentCode || !amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Agent code and valid amount are required' });
      return;
    }

    // Find agent by code
    const agent = await User.findOne({ agentCode, isAgent: true });
    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent not found' });
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

    // TODO Phase 3: Trigger pawaPay deposit + payout to agent here

    // Simulate success
    transaction.status = 'success';
    await transaction.save();

    res.status(201).json({
      success: true,
      transaction,
      agent: { name: agent.alias, code: agent.agentCode },
      fee,
      total: amount + fee,
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
