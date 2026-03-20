import { Request, Response, NextFunction } from 'express';

/**
 * Placeholder for global error handling middleware.
 */
export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'An unexpected error occurred.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
};