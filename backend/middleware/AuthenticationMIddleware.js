import jwt from 'jsonwebtoken'; // Import JWT library
const JWT_SECRET = process.env.JWT_SECRET || "my-secret";  // Get secret key from environment variables

const authMiddleware = (req, res, next) => {

    const token = req.header('Authorization').replace('Bearer ', ''); // Get token from request headers
    try{
        if (!token) { // Check if token is present
            return res.status(401).json({ error: 'Access Denied' }); // Send error response if token is missing
        }
        const decoded = jwt.verify(token.replace("Bearer",""), JWT_SECRET);
        req.email = decoded.email;
        next(); // Call next middleware if token is valid
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid Token' }); // Send error response if token is invalid
    }
}

export default authMiddleware; // Export the middleware function