import express from 'express';
import cors from 'cors';
import usersRouter from '../src/api/routes/users.routes.js';
import { errorMiddleware } from '../src/api/middleware/error.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount the Users router
// In Vercel, requests to /api/users/* are rewritten to this function.
app.use('/api/users', usersRouter);

// Error handling middleware
app.use(errorMiddleware);

export default app;
