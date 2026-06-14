import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Default to safe short lifetimes if unset — a missing env var must never
// produce a token with `expiresIn: undefined` (which never expires).
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export function signToken(email) {
  return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function signRefreshToken(email) {
  // A random jti makes every refresh token unique even when two are issued in
  // the same second (JWT's iat is whole-second precision). Without it, near-
  // simultaneous logins would produce identical tokens and revoking one would
  // revoke the others.
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ email, jti }, process.env.JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * Expiry of a just-signed token as a Date, read from its own `exp` claim.
 * Used to keep a DB-side expiry record exactly in sync with the JWT itself,
 * so the two can never drift apart regardless of the configured lifetime.
 */
export function getTokenExpiry(token) {
  const { exp } = jwt.decode(token);
  return new Date(exp * 1000);
}
