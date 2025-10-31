import { Response } from 'express';
import Wallet from '../models/Wallet';
import { AuthRequest } from '../middleware/auth';

// Detect provider from Zambian number prefix
const detectProvider = (phone: string): 'MTN' | 'Airtel' | 'Zamtel' => {
  const number = phone.replace('+260', '').replace('0', '');
  if (number.startsWith('96') || number.startsWith('76')) return 'MTN';
  if (number.startsWith('97') || number.startsWith('77')) return 'Airtel';
  if (number.startsWith('95') || number.startsWith('75')) return 'Zamtel';
  return 'MTN'; // default
};

// @route   GET /api/wallets
// @desc    Get all wallets for current user
// @access  Private
export const getWallets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallets = await Wallet.find({ userId: req.user!._id }).sort({ isPrimary: -1, createdAt: 1 });
    res.json({ success: true, wallets });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/wallets
// @desc    Add a new wallet
// @access  Private
export const addWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    const userId = req.user!._id;

    if (!phone) {
      res.status(400).json({ success: false, message: 'Phone number is required' });
      return;
    }

    // Check if wallet already exists for this user
    const existing = await Wallet.findOne({ userId, phone });
    if (existing) {
      res.status(400).json({ success: false, message: 'Wallet already added' });
      return;
    }

    const provider = detectProvider(phone);

    // If this is the first wallet, make it primary
    const walletCount = await Wallet.countDocuments({ userId });
    const isPrimary = walletCount === 0;

    const wallet = await Wallet.create({ userId, phone, provider, isPrimary });
    res.status(201).json({ success: true, wallet });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   PATCH /api/wallets/:id/primary
// @desc    Set wallet as primary
// @access  Private
export const setPrimaryWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    // Verify wallet belongs to user
    const wallet = await Wallet.findOne({ _id: id, userId });
    if (!wallet) {
      res.status(404).json({ success: false, message: 'Wallet not found' });
      return;
    }

    // Remove primary from all user wallets then set the new one
    await Wallet.updateMany({ userId }, { isPrimary: false });
    await Wallet.findByIdAndUpdate(id, { isPrimary: true });

    const wallets = await Wallet.find({ userId }).sort({ isPrimary: -1 });
    res.json({ success: true, wallets });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   DELETE /api/wallets/:id
// @desc    Remove a wallet
// @access  Private
export const removeWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const wallet = await Wallet.findOne({ _id: id, userId });
    if (!wallet) {
      res.status(404).json({ success: false, message: 'Wallet not found' });
      return;
    }

    if (wallet.isPrimary) {
      res.status(400).json({ success: false, message: 'Cannot remove primary wallet. Set another wallet as primary first.' });
      return;
    }

    await wallet.deleteOne();
    res.json({ success: true, message: 'Wallet removed' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
