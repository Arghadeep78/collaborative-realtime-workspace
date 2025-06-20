import { verifyToken } from '../utils/jwt.js';
import { APIError } from '../utils/APIError.js';

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';
        if (!token) {
            return next(new APIError(401, 'Access Denied'));
        }
        const decoded = verifyToken(token);
        req.email = decoded.email;
        next();
    }
    catch (error) {
        // Synchronous middleware: a bare throw is NOT auto-forwarded by Express 5
        // (only async/promise rejections are), so hand the error to next() explicitly.
        next(new APIError(401, 'Invalid Token'));
    }
}

export default authMiddleware; // Export the middleware function