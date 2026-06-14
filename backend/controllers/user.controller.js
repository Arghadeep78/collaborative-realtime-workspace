import userModel from "../models/user.model.js";
import Whiteboard from "../models/whiteboard.model.js";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { verifyToken } from "../utils/jwt.js";

// Generic reply shared by both forgot-password outcomes (found / not found) so
// the endpoint never reveals whether an email is registered.
const FORGOT_PASSWORD_REPLY =
  "If an account exists for that email, a password reset link has been sent.";

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
    res.status(400).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.login(email, password);

    const token = user.generateAccessToken();

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
    res.status(401).json({ message: error.message });
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

const renewToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Authorization token is required" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired, please log in again" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!decoded || !decoded.email) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await userModel.getUser(decoded.email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newtoken = user.generateAccessToken();
    res.status(200).json({
      message: "Token renewed successfully",
      token: newtoken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Old and new passwords are required" });
    }

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
    res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

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
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "New password is required" });
    }

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
  renewToken,
  getUserProfile,
  updateUserProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
  getBulkProfiles,
};

