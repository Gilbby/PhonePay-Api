import { Router } from 'express';
import { checkPhone, sendOtp, verifyOtp, createAlias, setPin, verifyPin } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/check-phone', checkPhone);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/create-alias', protect, createAlias);
router.post('/set-pin', protect, setPin);
router.post('/verify-pin', protect, verifyPin);

export default router;
