import express from 'express';
import cors from 'cors';
import hrmRouter from '../src/api/routes/hrm.routes.js';
import usersRouter from '../src/api/routes/users.routes.js';
import { errorMiddleware } from '../src/api/middleware/error.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routers: both HRM and Users routes are served by this serverless function
app.use('/api/hrm', hrmRouter);
app.use('/api/users', usersRouter);

// Error handling middleware
app.use(errorMiddleware);

export default app;
