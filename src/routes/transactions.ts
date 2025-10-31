import { Router } from 'express';
import { getTransactions, sendMoney, getCash } from '../controllers/transactionController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getTransactions);
router.post('/send', sendMoney);
router.post('/cash-out', getCash);

export default router;
