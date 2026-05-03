import { Router } from 'express';
import { searchUsers } from '../controllers/userController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);
router.get('/search', searchUsers);

export default router;