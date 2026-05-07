import { Router, Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Wallet from '../models/Wallet';

const router = Router();

router.post('/pawapay/deposit', async (req: Request, res: Response) => {
  const { depositId, status, amount } = req.body;

  if (status === 'COMPLETED') {
    const tx = await Transaction.findOne({ reference: depositId });
    if (tx) {
      tx.status = 'success';  // ✅ was 'completed'
      await tx.save();
      await Wallet.findByIdAndUpdate(tx.receiverWalletId, {
        $inc: { balance: parseFloat(amount) }
      });
    }
  } else if (status === 'FAILED') {
    const tx = await Transaction.findOne({ reference: depositId });
    if (tx) {
      tx.status = 'failed';
      await tx.save();
    }
  }

  res.sendStatus(200);
});

router.post('/pawapay/payout', async (req: Request, res: Response) => {
  const { payoutId, status } = req.body;

  const tx = await Transaction.findOne({ reference: payoutId });
  if (tx) {
    tx.status = status === 'COMPLETED' ? 'success' : 'failed';  // ✅ fixed
    await tx.save();
  }

  res.sendStatus(200);
});

router.post('/pawapay/refund', async (req: Request, res: Response) => {
  res.sendStatus(200);
});

export default router;