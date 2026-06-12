import {
  registerUser,
  loginUser,
  googleLogin,
  renewToken,
  updatePassword,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  getBulkProfiles,
} from "../controllers/user.controller.js";
import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { imageUpload, mediaUpload, upload } from "../middleware/image-upload.middleware.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google-login", googleLogin);
router.post("/renew-token", renewToken);
// Password reset (public; the whole /users router is behind authLimiter in index.js).
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/profile", authMiddleware, getUserProfile);
router.get("/profiles", authMiddleware, getBulkProfiles);
router.put("/profile", authMiddleware, updateUserProfile);
router.put("/profile/password", authMiddleware, updatePassword);
router.post(
  "/profile/picture",
  authMiddleware,
  upload.single("image"),
  imageUpload
);

router.post(
  "/media/upload",
  authMiddleware,
  upload.single("file"),
  mediaUpload
);

export default router;
