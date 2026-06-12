import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";

// How long a password-reset link stays valid.
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Same complexity rule used by register/updatePassword — kept in one place.
const PASSWORD_POLICY =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

// Reset tokens are looked up by value, so they must hash DETERMINISTICALLY
// (unlike passwords, which use salted bcrypt). SHA-256 of the raw token is
// what we store; the raw token only ever lives in the emailed link.
const hashResetToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

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
  },
  {
    timestamps: true,
    collection: "resumeusers",
  }
);

// STATIC METHOD: register a new user
userSchema.statics.register = async function (name, email, password, role) {
  try {
    if (!validator.isEmail(email)) {
      throw new Error("Invalid email format.");
    }
    if (role !== "admin" && role !== "user") {
      throw new Error("Invalid role. Role must be either 'admin' or 'user'.");
    }
    if (!PASSWORD_POLICY.test(password)) {
      throw new Error(
        "Password must be at least 8 characters long and include one letter, one number, and one special character."
      );
    }

    // An email is tied to exactly ONE auth method.
    const existingUser = await this.findOne({ email });
    if (existingUser && existingUser.password) {
      throw new Error("User already exists with this email.");
    }
    if (existingUser && existingUser.googleId) {
      throw new Error(
        "This email is already registered with Google. Please sign in with Google instead."
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await new this({
      name,
      email,
      password: hashedPassword,
      role,
      authProvider: "local",
    }).save();
    return newUser;
  } catch (error) {
    throw new Error("Error registering user: " + error.message);
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
      throw new Error(
        "New password must be at least 8 characters long and include one letter, one number, and one special character."
      );
    }

    const user = await this.findOne({ email: userEmail });
    if (!user) {
      throw new Error("User not found.");
    }

    // If user registered with Google but trying to update password
    if (user.authProvider === "google" && !user.password) {
      throw new Error(
        "This account is linked with Google. Please use Google Sign-in."
      );
    }

    // Check old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new Error("Old password is incorrect.");
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    return await user.save();
  } catch (error) {
    throw new Error("Error updating password: " + error.message);
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
  user.resetPasswordToken = hashResetToken(rawToken);
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
    resetPasswordToken: hashResetToken(rawToken),
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    throw new Error("Password reset link is invalid or has expired.");
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);

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
      throw new Error(
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
    throw new Error("Error with Google authentication: " + error.message);
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
      throw new Error("Invalid email or password.");
    }

    // If user registered with Google but trying to login with password
    if (user.authProvider === "google" && !user.password) {
      throw new Error(
        "This account is linked with Google. Please use Google Sign-in."
      );
    }

    // Compare the password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }

    return user;
  } catch (error) {
    throw new Error("Error logging in: " + error.message);
  }
};

// Export model
const User = mongoose.model("User", userSchema);
export default User;
