import { verifyToken } from '../utils/jwt.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set — refusing to start without a real secret');

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