import { Router } from 'express';
import { transcribeAudio, summariseTranscript } from '../controllers/groq.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Rate limiting or specific auth middleware can be added here.
// For Phase 2 local development and testing, we use standard authMiddleware or bypass if needed.
// We can apply authMiddleware to secure it.
router.use(authMiddleware);

router.post('/transcribe', transcribeAudio);
router.post('/summarise', summariseTranscript);

export default router;
