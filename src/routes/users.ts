import { Router } from 'express';
import { searchUsers, searchAgents } from '../controllers/userController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);
router.get('/search', searchUsers);
router.get('/agents/search', searchAgents);

export default router;