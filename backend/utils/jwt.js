import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '40m';

export function signToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** Decodes a Bearer token without throwing — returns email or null. */
export function softDecodeEmail(token) {
  try {
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET).email || null;
  } catch {
    return null;
  }
}
