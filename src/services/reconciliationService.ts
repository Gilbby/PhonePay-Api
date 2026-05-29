import cron from 'node-cron';
import Transaction from '../models/Transaction';
import Wallet from '../models/Wallet';
import { initiatePayout } from './pawapayService';

const PAWAPAY_BASE_URL = process.env.PAWAPAY_BASE_URL!;
const PAWAPAY_TOKEN = process.env.PAWAPAY_API_TOKEN!;

const checkDepositStatus = async (depositId: string) => {
  const res = await fetch(`${PAWAPAY_BASE_URL}/v2/deposits/${depositId}`, {
    headers: {
      Authorization: `Bearer ${PAWAPAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
};

export const startReconciliation = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const pendingTx = await Transaction.find({
        status: 'pending',
        depositStatus: 'pending',
        depositId: { $exists: true },
        createdAt: { $lt: fifteenMinutesAgo },
      });

      console.log(`Reconciliation: checking ${pendingTx.length} pending transactions`);

      for (const tx of pendingTx) {
        try {
          if (!tx.depositId) continue;

          const result = await checkDepositStatus(tx.depositId);

          if (result.status === 'COMPLETED' && tx.depositStatus !== 'success') {
            tx.depositStatus = 'success';
            await tx.save();

            // Trigger payout if not already done
            if (!tx.payoutId) {
              let recipientPhone: string | null = null;

              if (tx.type === 'sent' && tx.receiverId) {
                const wallet = await Wallet.findOne({ userId: tx.receiverId, isPrimary: true });
                recipientPhone = wallet?.phone ?? null;
              } else if (tx.type === 'cash_out' && tx.agentId) {
                const wallet = await Wallet.findOne({ userId: tx.agentId, isPrimary: true });
                recipientPhone = wallet?.phone ?? null;
              }

              if (recipientPhone) {
                const { payoutId, data } = await initiatePayout(recipientPhone, tx.amount);
                if (data.status === 'ACCEPTED') {
                  tx.payoutId = payoutId;
                  await tx.save();
                }
              }
            }
          } else if (result.status === 'FAILED') {
            tx.depositStatus = 'failed';
            tx.status = 'failed';
            await tx.save();
          } else if (result.status === 'NOT_FOUND') {
            tx.status = 'failed';
            await tx.save();
          }
        } catch (err) {
          console.error(`Reconciliation error for tx ${tx._id}:`, err);
        }
      }
    } catch (err) {
      console.error('Reconciliation job error:', err);
    }
  });

  console.log('Reconciliation job started');
};
