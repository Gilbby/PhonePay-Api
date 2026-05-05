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

export const searchAgents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    // If no query, return all agents
    const filter: any = { isAgent: true };

    if (q && String(q).length > 0) {
      filter.$or = [
        { agentCode: { $regex: String(q), $options: 'i' } },
        { alias: { $regex: String(q), $options: 'i' } },
      ];
    }

    const agents = await User.find(filter)
      .select('_id alias phone agentCode')
      .limit(10);

    res.json({
      success: true,
      agents: agents.map((a) => ({
        id: a._id,
        code: a.agentCode,
        name: a.alias?.replace('@', '') ?? a.phone,
        location: 'Zambia',
      })),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const toggleAgentMode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isAgent } = req.body;
    const userId = req.user!._id;

    const updateData: any = { isAgent };

    // If enabling agent mode, generate an agent code if they don't have one
    if (isAgent) {
      const user = await User.findById(userId);
      if (!user?.agentCode) {
        updateData.agentCode = `AG${Date.now().toString().slice(-6)}`;
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      user: {
        id: user?._id,
        phone: user?.phone,
        alias: user?.alias,
        isAgent: user?.isAgent,
        agentCode: user?.agentCode,
        agentEarnings: user?.agentEarnings,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};