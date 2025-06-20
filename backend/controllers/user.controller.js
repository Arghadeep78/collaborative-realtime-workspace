import userModel from "../models/user.model.js";
import Whiteboard from "../models/whiteboard.model.js";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { verifyRefreshToken } from "../utils/jwt.js";
import { APIError } from "../utils/APIError.js";
import { sendResponse } from "../utils/sendResponse.js";

// Redis client injected once from app.js after createRedisClients().
// Kept module-level so controllers don't import Redis directly.
/** @type {import('redis').RedisClientType | null} */
let redis = null;

/**
 * Inject the Redis client used to store single-use WebSocket tickets.
 * Call this once from app.js immediately after createRedisClients().
 * @param {import('redis').RedisClientType} client
 */
export function setWsTicketRedis(client) {
  redis = client;
}

// Generic reply shared by both forgot-password outcomes (found / not found) so
// the endpoint never reveals whether an email is registered.
const FORGOT_PASSWORD_REPLY =
  "If an account exists for that email, a password reset link has been sent.";

// Name of the httpOnly cookie carrying the refresh token.
const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Scope the cookie to the /users routes — the browser attaches it only to
// /users/refresh and /users/logout (the only endpoints that need it), shrinking
// both its exposure and the CSRF surface vs. sending it on every request.
const REFRESH_COOKIE_PATH = "/users";

const refreshCookieOptions = () => ({
  httpOnly: true,
  // Secure must be on in production (HTTPS). Allow plain HTTP on localhost dev.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: REFRESH_COOKIE_PATH,
});

const setRefreshCookie = (res, rawToken) => {
  res.cookie(REFRESH_COOKIE, rawToken, {
    ...refreshCookieOptions(),
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
};

const clearRefreshCookie = (res) => {
  // clearCookie must be given the SAME path/options the cookie was set with,
  // otherwise the browser won't match and remove it.
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
};

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Fetch projects where the user is owner or collaborator */
const fetchProjectsForUser = async (email) => {
  return Whiteboard.find({
    $or: [{ owner: email }, { 'collaborators.email': email }]
  }).select('-yjsState').sort({ updatedAt: -1 }).lean();
};

/**
 * Backfill this user's profilePicture into any collaborator entries that were
 * recorded before they had an account (e.g. invited by email before signup, or
 * joined via a share link as a guest). Fire-and-forget — never blocks the response.
 */
const backfillCollaboratorPhoto = (email, profilePicture) => {
  if (!email || !profilePicture) return;
  Whiteboard.updateMany(
    { 'collaborators.email': email, 'collaborators.profilePicture': { $in: [null, ''] } },
    { $set: { 'collaborators.$[el].profilePicture': profilePicture } },
    { arrayFilters: [{ 'el.email': email, 'el.profilePicture': { $in: [null, ''] } }] }
  ).catch((err) => console.error('backfillCollaboratorPhoto error:', err));
};

const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await userModel.register(name, email, password, role);
    const token = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    setRefreshCookie(res, refreshToken);

    const projects = await fetchProjectsForUser(user.email);
    backfillCollaboratorPhoto(user.email, user.profilePicture);

    sendResponse(res, 201, "User registered successfully", {
      token,
      projects,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.login(email, password);

    const token = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    setRefreshCookie(res, refreshToken);

    const projects = await fetchProjectsForUser(user.email);
    backfillCollaboratorPhoto(user.email, user.profilePicture);

    sendResponse(res, 200, "User logged in successfully", {
      token,
      projects,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    next(error);
  }
};

const googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;
    // console.log(credential);
    if (!credential) {
      throw new APIError(400, "Google credential is required");
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    // console.log(payload);
    const { sub: googleId, name, email, picture } = payload;

    // Authenticate or create user
    const user = await userModel.googleAuth(googleId, name, email, picture);

    // Generate JWT token
    const token = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    setRefreshCookie(res, refreshToken);

    // Fetch user's projects
    const projects = await fetchProjectsForUser(user.email);
    backfillCollaboratorPhoto(user.email, user.profilePicture);

    sendResponse(res, 200, "User logged in successfully", {
      token,
      projects,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    next(error);
  }
};

// Exchange the httpOnly refresh-token cookie for a fresh 15-min access token.
// The refresh token is verified both cryptographically (signature + expiry) and
// against the DB (so a revoked/logged-out token can't be replayed).
const refreshAccessToken = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      throw new APIError(401, "Refresh token is required");
    }

    // Signature + expiry check first — cheap, and rejects forged/expired tokens
    // before we touch the database. Decoded payload intentionally unused;
    // findByRefreshToken does the user lookup via hash, not email from JWT.
    try {
      verifyRefreshToken(rawToken);
    } catch {
      clearRefreshCookie(res);
      throw new APIError(401, "Invalid or expired refresh token");
    }

    // Must still be an active token for this user (not logged out / revoked).
    const user = await userModel.findByRefreshToken(rawToken);
    if (!user) {
      clearRefreshCookie(res);
      throw new APIError(401, "Refresh token no longer valid");
    }

    const token = user.generateAccessToken();
    sendResponse(res, 200, "Token refreshed successfully", { token });
  } catch (error) {
    next(error);
  }
};

// Revoke the current refresh token and clear the cookie. Idempotent: succeeds
// even if the cookie is missing or already-revoked, so the client can always
// complete logout locally.
const logoutUser = async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) {
      // Single atomic revoke — pull the matching hash wherever it lives. No need
      // to load the user first; a no-op if the token is unknown/already revoked.
      await userModel.revokeRefreshToken(rawToken);
    }
    clearRefreshCookie(res);
    sendResponse(res, 200, "Logged out successfully");
  } catch (error) {
    // Even on error, clear the cookie so the client isn't stuck logged in.
    clearRefreshCookie(res);
    sendResponse(res, 200, "Logged out");
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const userEmail = req.email;
    const user = await userModel.getUser(userEmail);
    if (!user) {
      throw new APIError(404, "User not found");
    }
    sendResponse(res, 200, "Profile fetched", {
      name: user.name,
      profilePicture: user.profilePicture,
      authProvider: user.authProvider || 'local',
    });
  } catch (error) {
    next(error);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const userEmail = req.email; // Assuming req.user is set by authMiddleware
    const { name, profilePicture } = req.body;

    // Only update fields that were actually provided, so a request that sends
    // just one field doesn't blank out the other.
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;

    const updatedUser = await userModel.findOneAndUpdate(
      { email: userEmail },
      { $set: updates },
      { new: true } // return updated user
    );
    if (!updatedUser) {
      throw new APIError(404, "User not found");
    }

    sendResponse(res, 200, "Profile updated successfully", {
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        authProvider: updatedUser.authProvider || "local",
      },
    });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const userEmail = req.email;
    const { oldPassword, newPassword } = req.body; // presence/length checked by validate middleware

    await userModel.updatenewPassword(userEmail, oldPassword, newPassword);
    sendResponse(res, 200, "Password updated successfully");
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body; // validated by validate middleware

    const result = await userModel.requestPasswordReset(email);

    // Only send mail when there's a real resettable account, but ALWAYS return
    // the same response so the caller can't distinguish the two cases.
    if (result) {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${result.rawToken}`;
      try {
        await sendPasswordResetEmail({ toEmail: email, resetUrl });
      } catch (mailErr) {
        // Don't leak delivery failures to the client (same enumeration concern),
        // but do log them so the issue is visible server-side.
        console.error("Failed to send password reset email:", mailErr);
      }
    }

    sendResponse(res, 200, FORGOT_PASSWORD_REPLY);
  } catch (error) {
    // Even on an unexpected error, keep the response generic.
    console.error("forgotPassword error:", error);
    sendResponse(res, 200, FORGOT_PASSWORD_REPLY);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body; // validated by validate middleware

    await userModel.resetPassword(token, password);

    sendResponse(res, 200, "Password has been reset successfully. You can now log in.");
  } catch (error) {
    next(error);
  }
};

/**
 * Issue a single-use WebSocket ticket for the authenticated caller.
 *
 * The ticket (64 hex chars / 32 random bytes) is stored in Redis with a
 * 30-second TTL. The frontend exchanges it for a WebSocket connection via
 * `?ticket=<hex>` in the upgrade URL. The server's upgrade gate immediately
 * DELetes it on first use, so each ticket is valid for exactly one connection.
 * This prevents the JWT from ever appearing in a WS URL, server log, or proxy
 * access log.
 */
const issueWsTicket = async (req, res, next) => {
  try {
    if (!redis) throw new APIError(503, 'Ticket service unavailable');
    const ticket = randomBytes(32).toString('hex');
    await redis.set(`ws:ticket:${ticket}`, req.email, { EX: 30 });
    sendResponse(res, 200, 'Ticket issued', { ticket });
  } catch (error) {
    next(error);
  }
};

const getBulkProfiles = async (req, res, next) => {
  try {
    const emails = (req.query.emails || '').split(',').map(e => e.trim()).filter(Boolean);
    if (!emails.length) return sendResponse(res, 200, 'Profiles fetched', []);
    const users = await userModel.find({ email: { $in: emails } })
      .select('email name profilePicture')
      .lean();
    sendResponse(res, 200, 'Profiles fetched', users.map(u => ({
      email: u.email,
      name: u.name,
      profilePicture: u.profilePicture || '',
    })));
  } catch (error) {
    next(error);
  }
};

export {
  registerUser,
  loginUser,
  googleLogin,
  refreshAccessToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
  getBulkProfiles,
  issueWsTicket,
};

