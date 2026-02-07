import jwt from 'jsonwebtoken';

export const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userEmail = decoded.email;
    
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};