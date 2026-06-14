import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import multer from 'multer';

export const upload = multer({ dest: 'uploads/' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadToCloudinary(filePath, options = {}) {
  try {
    const result = await cloudinary.uploader.upload(filePath, options);
    fs.unlinkSync(filePath);
    return result;
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw error;
  }
}

export const imageUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
  try {
    const result = await uploadToCloudinary(req.file.path, { folder: 'user_profile_pictures' });
    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Handles image, video, and audio uploads for project media blocks.
// Cloudinary resource_type 'auto' detects the file type automatically.
export const mediaUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
  try {
    const result = await uploadToCloudinary(req.file.path, { resource_type: 'auto', folder: 'board_media' });

    // Derive a clean mediaType for the frontend
    const audioFormats = new Set(['mp3', 'wav', 'ogg', 'aac']);
    const mediaType = result.resource_type === 'video' && !audioFormats.has(result.format) ? 'video'
      : result.resource_type === 'video' ? 'audio'
      : 'image';

    res.json({ success: true, url: result.secure_url, mediaType, format: result.format });
  } catch (error) {
    console.error("Cloudinary Media Upload Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
