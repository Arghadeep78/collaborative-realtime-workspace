import {
  registerUser,
  loginUser,
  googleLogin,
  refreshAccessToken,
  logoutUser,
  updatePassword,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  getBulkProfiles,
} from "../controllers/user.controller.js";
import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import { imageUpload, mediaUpload } from "../controllers/upload.controller.js";
import { validate, fields, optional } from "../middleware/validate.middleware.js";
const router = express.Router();

router.post(
  "/register",
  validate({
    name: fields.name,
    email: fields.email,
    password: fields.password,
    role: fields.role, // required; model rejects undefined
  }),
  registerUser
);
router.post(
  "/login",
  validate({ email: fields.email, password: fields.required }),
  loginUser
);
router.post("/google-login", googleLogin);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
// Password reset (public; the whole /users router is behind authLimiter in index.js).
router.post(
  "/forgot-password",
  validate({ email: fields.email }),
  forgotPassword
);
router.post(
  "/reset-password/:token",
  validate({ password: fields.password }),
  resetPassword
);
router.get("/profile", authMiddleware, getUserProfile);
router.get("/profiles", authMiddleware, getBulkProfiles);
router.put(
  "/profile",
  authMiddleware,
  validate({ name: optional(fields.name) }),
  updateUserProfile
);
router.put(
  "/profile/password",
  authMiddleware,
  validate({ oldPassword: fields.required, newPassword: fields.password }),
  updatePassword
);
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
