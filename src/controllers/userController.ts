import { Request, Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

// @route   GET /api/users/search?q=alias_or_phone
// @desc    Search users by alias or phone
// @access  Private
export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || String(q).length < 2) {
      res.json({ success: true, users: [] });
      return;
    }

    const query = String(q).toLowerCase();

    const users = await User.find({
      _id: { $ne: req.user!._id }, // exclude self
      $or: [
        { alias: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
      ],
    })
      .select('_id alias phone')
      .limit(10);

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        name: u.alias?.replace('@', '') ?? u.phone,
        alias: u.alias,
        phone: u.phone,
      })),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};