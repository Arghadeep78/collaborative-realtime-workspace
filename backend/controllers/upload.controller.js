import { uploadToCloudinary } from '../utils/cloudinary.js';

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
