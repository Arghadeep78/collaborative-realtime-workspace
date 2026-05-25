import jwt from 'jsonwebtoken'; // Import JWT library
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set — refusing to start without a real secret');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';
        if (!token) { // Check if token is present
            return res.status(401).json({ error: 'Access Denied' }); // Send error response if token is missing
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        req.email = decoded.email;
        next(); // Call next middleware if token is valid
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid Token' }); // Send error response if token is invalid
    }
}

export default authMiddleware; // Export the middleware function