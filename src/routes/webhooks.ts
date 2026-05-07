import { Router, Request, Response } from 'express';
import Transaction from '../models/Transaction';
import { initiateRefund } from '../services/pawapayService';

const router = Router();

router.post('/pawapay/deposit', async (req: Request, res: Response) => {
  try {
    const { depositId, status } = req.body;

    const tx = await Transaction.findOne({ reference: depositId });
    if (!tx) {
      res.sendStatus(200);
      return;
    }

    if (status === 'COMPLETED') {
      tx.status = 'success';
      await tx.save();
    } else if (status === 'FAILED') {
      tx.status = 'failed';
      await tx.save();
    }
  } catch (err) {
    console.error('Deposit webhook error:', err);
  }

  res.sendStatus(200);
});

router.post('/pawapay/payout', async (req: Request, res: Response) => {
  try {
    const { payoutId, status } = req.body;

    const tx = await Transaction.findOne({ reference: payoutId });
    if (!tx) {
      res.sendStatus(200);
      return;
    }

    if (status === 'COMPLETED') {
      tx.status = 'success';
      await tx.save();
    } else if (status === 'FAILED') {
      tx.status = 'failed';
      await tx.save();

      // Payout failed — find the original sent/cash_out transaction
      // and refund the sender's deposit
      const sentTx = await Transaction.findOne({
        $or: [
          { senderId: tx.senderId, type: 'sent', status: 'success' },
          { senderId: tx.senderId, type: 'cash_out', status: 'success' },
        ],
      }).sort({ createdAt: -1 });

      if (sentTx) {
        const { refundId, data } = await initiateRefund(
          sentTx.reference,
          sentTx.amount + sentTx.fee
        );

        if (data.status === 'ACCEPTED') {
          console.log(`Refund initiated: ${refundId} for failed payout ${payoutId}`);
        } else {
          console.error(`Refund failed for payout ${payoutId}:`, data);
        }
      }
    }
  } catch (err) {
    console.error('Payout webhook error:', err);
  }

  res.sendStatus(200);
});

router.post('/pawapay/refund', async (req: Request, res: Response) => {
  try {
    const { refundId, status } = req.body;

    if (status === 'COMPLETED') {
      console.log(`Refund ${refundId} completed successfully`);
      // TODO: notify user their refund was processed
    } else if (status === 'FAILED') {
      console.error(`Refund ${refundId} failed — manual intervention needed`);
      // TODO: alert admin
    }
  } catch (err) {
    console.error('Refund webhook error:', err);
  }

  res.sendStatus(200);
});

export default router;