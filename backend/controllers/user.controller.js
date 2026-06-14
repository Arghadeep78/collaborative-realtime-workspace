import userModel from "../models/user.model.js";
import Whiteboard from "../models/whiteboard.model.js";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { verifyRefreshToken } from "../utils/jwt.js";

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

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await userModel.register(name, email, password, role);
    const token = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    setRefreshCookie(res, refreshToken);

    const projects = await fetchProjectsForUser(user.email);
    backfillCollaboratorPhoto(user.email, user.profilePicture);

    res.status(201).json({
      message: "User registered successfully",
      token,
      projects,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    res
      .status(error.isOperational ? 400 : 500)
      .json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.login(email, password);

    const token = user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    setRefreshCookie(res, refreshToken);

    const projects = await fetchProjectsForUser(user.email);
    backfillCollaboratorPhoto(user.email, user.profilePicture);

    res.status(200).json({
      message: "User logged in successfully",
      token,
      projects,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    res
      .status(error.isOperational ? (error.status ?? 401) : 500)
      .json({ message: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    // console.log(credential);
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
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

    res.status(200).json({
      message: "User logged in successfully",
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
    res
      .status(401)
      .json({ message: error.message || "Google authentication failed" });
  }
};

// Exchange the httpOnly refresh-token cookie for a fresh 15-min access token.
// The refresh token is verified both cryptographically (signature + expiry) and
// against the DB (so a revoked/logged-out token can't be replayed).
const refreshAccessToken = async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      return res.status(401).json({ message: "Refresh token is required" });
    }

    // Signature + expiry check first — cheap, and rejects forged/expired tokens
    // before we touch the database. Decoded payload intentionally unused;
    // findByRefreshToken does the user lookup via hash, not email from JWT.
    try {
      verifyRefreshToken(rawToken);
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Must still be an active token for this user (not logged out / revoked).
    const user = await userModel.findByRefreshToken(rawToken);
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Refresh token no longer valid" });
    }

    const token = user.generateAccessToken();
    res.status(200).json({
      message: "Token refreshed successfully",
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    // Even on error, clear the cookie so the client isn't stuck logged in.
    clearRefreshCookie(res);
    res.status(200).json({ message: "Logged out" });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userEmail = req.email;
    // console.log("Fetching profile for user:", userEmail);
    const user = await userModel.getUser(userEmail);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      name: user.name,
      profilePicture: user.profilePicture,
      authProvider: user.authProvider || 'local',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserProfile = async (req, res) => {
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
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        authProvider: updatedUser.authProvider || "local",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const userEmail = req.email;
    const { oldPassword, newPassword } = req.body; // presence/length checked by validate middleware

    const user = await userModel.updatenewPassword(
      userEmail,
      oldPassword,
      newPassword
    );
    if (!user) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res
      .status(error.isOperational ? 400 : 500)
      .json({ message: error.message });
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

    res.status(200).json({ message: FORGOT_PASSWORD_REPLY });
  } catch (error) {
    // Even on an unexpected error, keep the response generic.
    console.error("forgotPassword error:", error);
    res.status(200).json({ message: FORGOT_PASSWORD_REPLY });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body; // validated by validate middleware

    await userModel.resetPassword(token, password);

    res.status(200).json({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    // Surface validation / expiry errors to the user (these aren't sensitive).
    res.status(400).json({ message: error.message });
  }
};

const getBulkProfiles = async (req, res) => {
  try {
    const emails = (req.query.emails || '').split(',').map(e => e.trim()).filter(Boolean);
    if (!emails.length) return res.status(200).json([]);
    const users = await userModel.find({ email: { $in: emails } })
      .select('email name profilePicture')
      .lean();
    res.status(200).json(users.map(u => ({
      email: u.email,
      name: u.name,
      profilePicture: u.profilePicture || '',
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
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
};

