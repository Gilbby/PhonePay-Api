import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Wallet from '../models/Wallet';
import { initiatePayout, initiateRefund } from '../services/pawapayService';

const validatePawapaySignature = (req: Request): boolean => {
  const secret = process.env.PAWAPAY_WEBHOOK_SECRET;
  if (!secret) return true; // Skip validation in dev if secret not set

  const signature = req.headers['x-pawapay-signature'] as string;
  if (!signature) return false;

  const payload = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
};

const router = Router();

router.post('/pawapay/deposit', async (req: Request, res: Response) => {
  if (!validatePawapaySignature(req)) {
    res.status(401).json({ message: 'Invalid signature' });
    return;
  }

  res.sendStatus(200); // Always respond immediately

  try {
    const { depositId, status } = req.body;

    const tx = await Transaction.findOne({ depositId });
    if (!tx) return;

    if (status === 'COMPLETED') {
      tx.depositStatus = 'success';
      await tx.save();

      let recipientPhone: string | null = null;

      if (tx.type === 'sent' && tx.receiverId) {
        const recipientWallet = await Wallet.findOne({ userId: tx.receiverId, isPrimary: true });
        recipientPhone = recipientWallet?.phone ?? null;
      } else if (tx.type === 'cash_out' && tx.agentId) {
        const agentWallet = await Wallet.findOne({ userId: tx.agentId, isPrimary: true });
        recipientPhone = agentWallet?.phone ?? null;
      }

      if (recipientPhone) {
        const { payoutId, data: payoutData } = await initiatePayout(recipientPhone, tx.amount);

        if (payoutData.status === 'ACCEPTED') {
          tx.payoutId = payoutId;
          await tx.save();

          if (tx.type === 'sent' && tx.receiverId) {
            await Transaction.create({
              type: 'received',
              amount: tx.amount,
              fee: 0,
              status: 'pending',
              senderId: tx.senderId,
              receiverId: tx.receiverId,
              depositId: depositId,
              payoutId: payoutId,
              reference: `${tx.reference}-R`,
            });
          }
        } else {
          tx.status = 'failed';
          tx.payoutStatus = 'failed';
          await tx.save();
          await initiateRefund(depositId, tx.amount + tx.fee);
        }
      }
    } else if (status === 'FAILED') {
      tx.depositStatus = 'failed';
      tx.status = 'failed';
      await tx.save();
    }
  } catch (err) {
    console.error('Deposit webhook error:', err);
  }
});

router.post('/pawapay/payout', async (req: Request, res: Response) => {
  if (!validatePawapaySignature(req)) {
    res.status(401).json({ message: 'Invalid signature' });
    return;
  }

  res.sendStatus(200);

  try {
    const { payoutId, status } = req.body;

    const tx = await Transaction.findOne({ payoutId });
    if (!tx) return;

    if (status === 'COMPLETED') {
      tx.payoutStatus = 'success';
      tx.status = 'success';
      await tx.save();

      const mirrorTx = await Transaction.findOne({ payoutId, type: 'received' });
      if (mirrorTx) {
        mirrorTx.status = 'success';
        await mirrorTx.save();
      }
    } else if (status === 'FAILED') {
      tx.payoutStatus = 'failed';
      tx.status = 'failed';
      await tx.save();

      if (tx.depositId) {
        await initiateRefund(tx.depositId, tx.amount + tx.fee);
      }
    }
  } catch (err) {
    console.error('Payout webhook error:', err);
  }
});

router.post('/pawapay/refund', async (req: Request, res: Response) => {
  if (!validatePawapaySignature(req)) {
    res.status(401).json({ message: 'Invalid signature' });
    return;
  }

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