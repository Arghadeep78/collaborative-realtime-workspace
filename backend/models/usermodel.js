import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";

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
  },
  {
    timestamps: true,
    collection: "resumeusers",
  }
);

// STATIC METHOD: register a new user
userSchema.statics.register = async function (name, email, password, role) {
  try {
    // Validate email and password
    if (!validator.isEmail(email)) {
      throw new Error("Invalid email format.");
    }
    if (
      !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(
        password
      )
    ) {
      throw new Error(
        "Password must be at least 8 characters long and include one letter, one number, and one special character."
      );
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user instance
    const user = new this({
      name,
      email,
      password: hashedPassword,
      role,
      authProvider: "local",
    });

    if (role !== "admin" && role !== "user") {
      throw new Error("Invalid role. Role must be either 'admin' or 'user'.");
    }

    // Check if user already exists and password is not empty
    const existingUser = await this.findOne({ email });
    if (existingUser && existingUser.password) {
      throw new Error("User already exists with this email.");
    }
    if (existingUser && existingUser.googleId && !password) {
      // User exists with Google ID
      // Update the user with new password
      existingUser.name = name;
      existingUser.password = hashedPassword;
      existingUser.role = role;
      return await existingUser.save();
    }

    const newUser = await user.save();
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
    if (
      !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(
        newPassword
      )
    ) {
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
      user.password = newPassword; // Set new password
      user.authProvider = "local"; // Change auth provider to local
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
      // Update user info if needed
      user.name = name;
      user.profilePicture = profilePicture;
      await user.save();
      return user;
    }

    // Check if user exists with email but no Google ID
    user = await this.findOne({ email });
    if (user) {
      // Link Google account to existing user
      user.googleId = googleId;
      user.profilePicture = profilePicture;
      user.authProvider = "google";
      await user.save();
      return user;
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

// STATIC METHOD: get all users
userSchema.statics.getUser = async function (email) {
  try {
    const user = await this.findOne({ email });
    if (!user) {
      throw new Error("User not found.");
    }
    return user;
  } catch (error) {
    throw new Error("Error fetching user: " + error.message);
  }
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
