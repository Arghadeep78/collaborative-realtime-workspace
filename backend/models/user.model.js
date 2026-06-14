import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";
import { signToken, signRefreshToken, getTokenExpiry } from "../utils/jwt.js";

// How long a password-reset link stays valid.
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Same complexity rule used by register/updatePassword — kept in one place.
const PASSWORD_POLICY =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

// Reset & refresh tokens are looked up by value, so they must hash
// DETERMINISTICALLY (unlike passwords, which use salted bcrypt). We store the
// SHA-256 of the raw token; the raw token only ever lives in the emailed link
// (reset) or the httpOnly cookie (refresh).
const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

// Errors we deliberately throw to inform the user (bad input, "already exists",
// wrong password, …) are SAFE to surface. Mark them so the catch blocks below
// can re-throw them untouched, while genericizing everything else.
const operationalError = (message, status = null) => {
  const err = new Error(message);
  err.isOperational = true;
  if (status) err.status = status;
  return err;
};

// Use in a model catch block: pass through our intentional messages; for any
// unexpected failure (DB/driver/bcrypt), log the real cause server-side and
// throw a generic message so internals never reach the client.
const rethrow = (context, error) => {
  if (error?.isOperational) throw error;
  console.error(`${context}:`, error);
  throw new Error(`${context}. Please try again.`);
};

// Define schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Password not required if Google login
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
    },
    profilePicture: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    // Password-reset flow: we store only the SHA-256 hash of the token, never
    // the raw value, so a DB leak can't be used to reset anyone's password.
    resetPasswordToken: {
      type: String,
      default: null,
      select: false, // never ship this to the client by default
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    // Active refresh tokens (one per logged-in device/tab). We store only the
    // SHA-256 hash of each token, never the raw value, so a DB leak can't be
    // used to mint new sessions. select:false so they never ship to the client.
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          expiresAt: { type: Date, required: true },
        },
      ],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    collection: "resumeusers",
  }
);

// Hash password before saving if it was modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plain password against the stored hash
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Instance method to generate a signed JWT access token for this user
userSchema.methods.generateAccessToken = function () {
  return signToken(this.email);
};

// Instance method: issue a new refresh token. Signs the JWT, persists only its
// hash + (token-derived) expiry, prunes any already-expired entries, and returns
// the RAW token (which only ever lives in the httpOnly cookie).
//
// We use an atomic updateOne aggregation pipeline ($set with $filter to drop
// expired entries + $concatArrays to append the new one) rather than
// read-modify-save: refreshTokens is select:false and is usually NOT loaded on
// `this`, so a save() would clobber tokens from the user's other devices. The
// atomic update also makes concurrent logins safe (no lost writes).
userSchema.methods.generateRefreshToken = async function () {
  const rawToken = signRefreshToken(this.email);
  // Read expiry straight from the token's own exp claim so the DB record and
  // the signed JWT can never drift apart, whatever JWT_REFRESH_EXPIRES_IN is.
  const expiresAt = getTokenExpiry(rawToken);
  const now = new Date();
  await this.constructor.updateOne({ _id: this._id }, [
    {
      $set: {
        refreshTokens: {
          // Keep only still-valid entries, then append the new one.
          $concatArrays: [
            {
              $filter: {
                input: { $ifNull: ["$refreshTokens", []] },
                cond: { $gt: ["$$this.expiresAt", now] },
              },
            },
            [
              {
                tokenHash: hashToken(rawToken),
                expiresAt,
              },
            ],
          ],
        },
      },
    },
  ]);
  return rawToken;
};

// STATIC METHOD: revoke a refresh token by value in a single atomic write,
// without loading the user document first (used on logout). No-op if the token
// is unknown or already revoked.
userSchema.statics.revokeRefreshToken = async function (rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await this.updateOne(
    { "refreshTokens.tokenHash": tokenHash },
    { $pull: { refreshTokens: { tokenHash } } }
  );
};

// STATIC METHOD: find the user who holds this refresh token, provided the
// stored entry hasn't expired. The refreshTokens field is select:false, so ask
// for it explicitly. Returns null when no live match exists.
userSchema.statics.findByRefreshToken = async function (rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  return this.findOne({
    refreshTokens: {
      $elemMatch: { tokenHash, expiresAt: { $gt: new Date() } },
    },
  }).select("+refreshTokens");
};

// STATIC METHOD: register a new user
userSchema.statics.register = async function (name, email, password, role) {
  try {
    if (!validator.isEmail(email)) {
      throw operationalError("Invalid email format.");
    }
    if (role !== "admin" && role !== "user") {
      throw operationalError("Invalid role. Role must be either 'admin' or 'user'.");
    }
    if (!PASSWORD_POLICY.test(password)) {
      throw operationalError(
        "Password must be at least 8 characters long and include one letter, one number, and one special character."
      );
    }

    // An email is tied to exactly ONE auth method.
    const existingUser = await this.findOne({ email });
    if (existingUser && existingUser.password) {
      throw operationalError("User already exists with this email.");
    }
    if (existingUser && existingUser.googleId) {
      throw operationalError(
        "This email is already registered with Google. Please sign in with Google instead."
      );
    }

    const newUser = await new this({
      name,
      email,
      password,
      role,
      authProvider: "local",
    }).save();
    return newUser;
  } catch (error) {
    rethrow("Error registering user", error);
  }
};

// Static method to update password
userSchema.statics.updatenewPassword = async function (
  userEmail,
  oldPassword,
  newPassword
) {
  try {
    // Validate new password
    if (!PASSWORD_POLICY.test(newPassword)) {
      throw operationalError(
        "New password must be at least 8 characters long and include one letter, one number, and one special character."
      );
    }

    const user = await this.findOne({ email: userEmail });
    if (!user) {
      throw operationalError("User not found.");
    }

    // If user registered with Google but trying to update password
    if (user.authProvider === "google" && !user.password) {
      throw operationalError(
        "This account is linked with Google. Please use Google Sign-in."
      );
    }

    // Check old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw operationalError("Old password is incorrect.");
    }

    user.password = newPassword;

    return await user.save();
  } catch (error) {
    rethrow("Error updating password", error);
  }
};

// STATIC METHOD: begin a password reset.
// Generates a single-use token, stores only its hash + expiry, and returns the
// RAW token to the caller (to be emailed). Returns null when the email has no
// resettable local-password account — the controller turns that into the same
// generic response either way so the endpoint can't be used to probe which
// emails are registered (enumeration).
userSchema.statics.requestPasswordReset = async function (email) {
  const user = await this.findOne({ email });
  if (!user) return null;

  // Google-only accounts have no password to reset.
  if (user.authProvider === "google" && !user.password) return null;

  const rawToken = crypto.randomBytes(32).toString("hex"); // 256 bits of entropy
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  // Issuing a new token implicitly invalidates any previous one (same field).
  return { user, rawToken };
};

// STATIC METHOD: complete a password reset.
// Verifies the token + expiry, sets the new password, and clears the token so
// it can only ever be used once.
userSchema.statics.resetPassword = async function (rawToken, newPassword) {
  if (!rawToken) {
    throw new Error("Reset token is required.");
  }
  if (!PASSWORD_POLICY.test(newPassword)) {
    throw new Error(
      "New password must be at least 8 characters long and include one letter, one number, and one special character."
    );
  }

  // The token fields are select:false, so ask for them explicitly here.
  const user = await this.findOne({
    resetPasswordToken: hashToken(rawToken),
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    throw new Error("Password reset link is invalid or has expired.");
  }

  user.password = newPassword;

  // Single-use: burn the token so the same link can't be replayed.
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;

  await user.save();
  return user;
};

// STATIC METHOD: register or login with Google
userSchema.statics.googleAuth = async function (
  googleId,
  name,
  email,
  profilePicture
) {
  try {
    // Check if user exists with Google ID
    let user = await this.findOne({ googleId });

    if (user) {
      // Update name but never overwrite a custom-uploaded profile picture.
      user.name = name;
      if (!user.profilePicture) user.profilePicture = profilePicture;
      await user.save();
      return user;
    }

    // An email is tied to exactly ONE auth method. If this email already has a
    // password account, don't link Google onto it — refuse and tell them to use
    // their password. (Existing pre-policy hybrid accounts are matched by the
    // googleId lookup above, so they still log in fine.)
    user = await this.findOne({ email });
    if (user) {
      throw operationalError(
        "This email is already registered with a password. Please sign in with your email and password instead."
      );
    }

    // Create new user with Google auth
    user = new this({
      name,
      email,
      googleId,
      profilePicture,
      authProvider: "google",
      role: "user",
    });

    const newUser = await user.save();
    return newUser;
  } catch (error) {
    rethrow("Error with Google authentication", error);
  }
};

// STATIC METHOD: get a user by email — returns null if not found
userSchema.statics.getUser = async function (email) {
  return this.findOne({ email });
};

userSchema.statics.login = async function (email, password) {
  try {
    const user = await this.findOne({ email });
    if (!user) {
      throw operationalError("Invalid email or password.");
    }

    // If user registered with Google but trying to login with password
    if (user.authProvider === "google" && !user.password) {
      throw operationalError(
        "This account is linked with Google. Please use Google Sign-in.",
        400
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw operationalError("Invalid email or password.");
    }

    return user;
  } catch (error) {
    rethrow("Error logging in", error);
  }
};

// Export model
const User = mongoose.model("User", userSchema);
export default User;
