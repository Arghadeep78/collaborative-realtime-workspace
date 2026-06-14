import { verifyToken } from '../utils/jwt.js';

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';
        if (!token) {
            return res.status(401).json({ error: 'Access Denied' });
        }
        const decoded = verifyToken(token);
        req.email = decoded.email;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid Token' });
    }
}

export default authMiddleware; // Export the middleware function