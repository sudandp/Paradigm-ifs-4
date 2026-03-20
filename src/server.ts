import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { errorMiddleware } from './api/middleware/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for large HTML content
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// API Routes

// Placeholder for other routes (e.g., users, organizations)
// app.use('/api/users', userRoutes);
// app.use('/api/organizations', organizationRoutes);

// Health Check
app.get('/', (req: Request, res: Response) => {
    res.send('Server is running.');
});

// Error Handler Middleware
app.use(errorMiddleware);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});