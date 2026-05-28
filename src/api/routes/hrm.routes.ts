import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  logCall,
  getCalls,
  moveStage,
  saveScreening,
  getScreening,
  getFeed,
  getQueue,
  assignHr,
  createLetter,
  getLetter,
  getLetters,
  updateLetterDraft,
  issueLetter,
  approveLetter,
  revokeLetter,
  getTemplates,
  updateTemplate,
  getFunnelReport,
  getLeaderboardReport,
  getKpisReport
} from '../controllers/hrm.controller.js';

const router = Router();

// Apply authMiddleware globally to all hrm routes
router.use(authMiddleware);

// Call logs
router.post('/calls', logCall);
router.get('/calls', getCalls);

// Candidate Stage transitions
router.patch('/candidates/:id/stage', moveStage);

// Screening Forms
router.post('/screening/:candidateId', saveScreening);
router.get('/screening/:candidateId', getScreening);

// Feed & Activity Logs
router.get('/feed/:candidateId', getFeed);

// HR Call Queue & Assignment
router.get('/queue', getQueue);
router.patch('/candidates/assign', assignHr);

// Letter Templates (Admin only)
router.get('/letters/templates', getTemplates);
router.put('/letters/templates/:type', updateTemplate);

// Letters Management
router.post('/letters', createLetter);
router.get('/letters', getLetters);
router.get('/letters/:id', getLetter);
router.put('/letters/:id', updateLetterDraft);
router.patch('/letters/:id/issue', issueLetter);
router.patch('/letters/:id/approve', approveLetter);
router.patch('/letters/:id/revoke', revokeLetter);

// Reports & KPIs
router.get('/reports/funnel', getFunnelReport);
router.get('/reports/leaderboard', getLeaderboardReport);
router.get('/reports/kpis', getKpisReport);

export default router;
