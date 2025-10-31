import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// Generate JWT
const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id }, secret, { expiresIn } as jwt.SignOptions);
};

// Generate 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Africa's Talking
const sendOTP = async (phone: string, otp: string): Promise<void> => {
  if (process.env.NODE_ENV === 'development') {
    // In development, just log the OTP instead of sending SMS
    console.log(`📱 OTP for ${phone}: ${otp}`);
    return;
  }

  // TODO: Wire up Africa's Talking in production
  // const AfricasTalking = require('africastalking');
  // const at = AfricasTalking({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
  // await at.SMS.send({ to: [phone], message: `Your PhonePay OTP is: ${otp}. Valid for 10 minutes.`, from: process.env.AT_SENDER_ID });
};

// @route   POST /api/auth/check-phone
// @desc    Check if phone exists (new or returning user)
// @access  Public
export const checkPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ success: false, message: 'Phone number is required' });
      return;
    }

    const user = await User.findOne({ phone });
    res.json({
      success: true,
      isNewUser: !user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/send-otp
// @desc    Send OTP to phone number
// @access  Public
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ success: false, message: 'Phone number is required' });
      return;
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

    // Upsert user with OTP
    await User.findOneAndUpdate(
      { phone },
      { otp, otpExpiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOTP(phone, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // Only return OTP in development for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and return JWT
// @access  Public
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      res.status(400).json({ success: false, message: 'Phone and OTP are required' });
      return;
    }

    const user = await User.findOne({ phone }).select('+otp +otpExpiresAt');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.otp || user.otp !== otp) {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
      return;
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      res.status(400).json({ success: false, message: 'OTP has expired' });
      return;
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const isNewUser = !user.alias;
    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      isNewUser,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        alias: user.alias,
        isAgent: user.isAgent,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/create-alias
// @desc    Set alias for new user
// @access  Private
export const createAlias = async (req: Request, res: Response): Promise<void> => {
  try {
    const { alias } = req.body;
    const userId = (req as any).user._id;

    if (!alias) {
      res.status(400).json({ success: false, message: 'Alias is required' });
      return;
    }

    const cleanAlias = alias.startsWith('@') ? alias : `@${alias}`;

    // Check if alias is taken
    const existing = await User.findOne({ alias: cleanAlias });
    if (existing) {
      res.status(400).json({ success: false, message: 'Alias is already taken' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { alias: cleanAlias },
      { new: true }
    );

    res.json({
      success: true,
      user: {
        id: user?._id,
        phone: user?.phone,
        alias: user?.alias,
        isAgent: user?.isAgent,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
