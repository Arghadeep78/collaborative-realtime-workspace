import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const imageUpload = async (req, res) => {
  try {
    const filePath = req.file.path;

    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'user_profile_pictures'
    });
    fs.unlinkSync(filePath);

    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handles image, video, and audio uploads for board media blocks.
// Cloudinary resource_type 'auto' detects the file type automatically.
export const mediaUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
  const filePath = req.file.path;
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',
      folder: 'board_media',
    });
    fs.unlinkSync(filePath);

    // Derive a clean mediaType for the frontend
    const mediaType = result.resource_type === 'video'
      ? (result.format === 'mp3' || result.format === 'wav' || result.format === 'ogg' || result.format === 'aac' ? 'audio' : 'video')
      : 'image';

    res.json({ success: true, url: result.secure_url, mediaType, format: result.format });
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error("Cloudinary Media Upload Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
