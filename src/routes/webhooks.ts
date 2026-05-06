import { Router, Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Wallet from '../models/Wallet';

const router = Router();

router.post('/pawapay/deposit', async (req: Request, res: Response) => {
  const { depositId, status, amount } = req.body;
  
  if (status === 'COMPLETED') {
    // Find the pending transaction and mark it complete
    const tx = await Transaction.findOne({ reference: depositId });
    if (tx) {
      tx.status = 'completed';
      await tx.save();
      // Update wallet balance
      await Wallet.findByIdAndUpdate(tx.receiverId, {
        $inc: { balance: parseFloat(amount) }
      });
    }
  }
  res.sendStatus(200); // Always acknowledge pawaPay
});

router.post('/pawapay/payout', async (req: Request, res: Response) => {
  const { payoutId, status } = req.body;

  const tx = await Transaction.findOne({ reference: payoutId });
  if (tx) {
    tx.status = status === 'COMPLETED' ? 'completed' : 'failed';
    await tx.save();
  }
  res.sendStatus(200);
});

router.post('/pawapay/refund', async (req: Request, res: Response) => {
  res.sendStatus(200); // Handle later
});

export default router;