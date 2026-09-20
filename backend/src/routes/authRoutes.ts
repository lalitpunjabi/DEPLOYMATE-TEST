import { Router } from 'express';
import { register, login, logout, forgotPassword, resetPassword, createWsTicket } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/ws-ticket', authenticateToken, createWsTicket);

export default router;
