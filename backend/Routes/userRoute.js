import {
  registerUser,
  loginUser,
  googleLogin,
  renewToken,
  updatePassword,
  getUserProfile,
  updateUserProfile,
} from "../Controllers/userController.js";
import express from "express";
import authMiddleware from "../middleware/AuthenticationMIddleware.js";
import { imageUpload } from "../Controllers/imageUpload.js";
import multer from "multer";
const upload = multer({ dest: "uploads/" }); // Temporary storage for uploaded files
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google-login", googleLogin);
router.post("/renew-token", renewToken);
router.get("/profile", authMiddleware, getUserProfile);
router.put("/profile", authMiddleware, updateUserProfile);
router.put("/profile/password", authMiddleware, updatePassword);
router.post(
  "/profile/picture",
  authMiddleware,
  upload.single("image"),
  imageUpload
);

export default router;
