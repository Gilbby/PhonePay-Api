import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Not authorized, no token' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not defined');

    const decoded = jwt.verify(token, secret) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({ success: false, message: 'User no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};
