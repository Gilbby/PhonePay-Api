import { Router } from 'express';
import { getWallets, addWallet, setPrimaryWallet, removeWallet } from '../controllers/walletController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getWallets);
router.post('/', addWallet);
router.patch('/:id/primary', setPrimaryWallet);
router.delete('/:id', removeWallet);

export default router;
