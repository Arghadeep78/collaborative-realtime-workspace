import userModel from "../models/usermodel.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Whiteboard from "../models/whiteboardModel.js";
import { OAuth2Client } from "google-auth-library";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Fetch boards where the user is owner or collaborator */
const fetchBoardsForUser = async (email) => {
  return Whiteboard.find({
    $or: [{ owner: email }, { 'collaborators.email': email }]
  }).select('-yjsState').sort({ updatedAt: -1 }).lean();
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await userModel.register(name, email, password, role);
    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "40m",
    });

    const boards = await fetchBoardsForUser(user.email);

    res.status(201).json({
      message: "User registered successfully",
      token,
      boards,
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

    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "40m",
    });

    const boards = await fetchBoardsForUser(user.email);

    res.status(200).json({
      message: "User logged in successfully",
      token,
      boards,
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
    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "40m",
    });

    // Fetch user's boards
    const boards = await fetchBoardsForUser(user.email);

    res.status(200).json({
      message: "User logged in successfully",
      token,
      boards,
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
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "Token expired, please log in again" });
      } else {
        return res.status(401).json({ message: "Invalid token" });
      }
    }

    if (!decoded || !decoded.email) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await userModel.getUser(decoded.email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newtoken = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "40m",
    });
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
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userEmail = req.email; // Assuming req.user is set by authMiddleware
    const { name, profilePicture } = req.body;

    const updatedUser = await userModel.findOneAndUpdate(
      { email: userEmail },
      {
        name: name,
        profilePicture: profilePicture,
      },
      { new: true } // return updated user
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        name: updatedUser.name,
        profilePicture: updatedUser.profilePicture,
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

export {
  registerUser,
  loginUser,
  googleLogin,
  renewToken,
  getUserProfile,
  updateUserProfile,
  updatePassword,
};

