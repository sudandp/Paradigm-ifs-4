import express from 'express';
import cors from 'cors';
import hrmRouter from '../src/api/routes/hrm.routes.js';
import { errorMiddleware } from '../src/api/middleware/error.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount the HRM router
// In Vercel, requests to /api/hrm/* are rewritten to this function.
// Since the path is preserved, mounting hrmRouter under /api/hrm matches perfectly.
app.use('/api/hrm', hrmRouter);

// Error handling middleware
app.use(errorMiddleware);

export default app;
