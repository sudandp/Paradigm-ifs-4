import express from 'express';
import { deleteUserController } from '../controllers/users.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * DELETE /api/users/:id
 * Permanent administrative user deletion with service-role constraint resolution
 */
router.delete('/:id', authMiddleware, deleteUserController);

export default router;
