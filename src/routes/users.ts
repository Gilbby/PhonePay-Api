import { Router } from 'express';
import { searchUsers, searchAgents, toggleAgentMode } from '../controllers/userController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);
router.get('/search', searchUsers);
router.get('/agents/search', searchAgents);
router.patch('/agent-mode', toggleAgentMode);


export default router;