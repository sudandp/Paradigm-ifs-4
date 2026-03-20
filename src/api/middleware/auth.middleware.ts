import { Request, Response, NextFunction } from 'express';

/**
 * Placeholder for authentication middleware.
 * In a real app, this would verify a JWT token and attach user data to the request.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // For now, just allow all requests to proceed
    next();
};