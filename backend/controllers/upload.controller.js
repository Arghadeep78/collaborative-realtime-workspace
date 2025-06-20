import { uploadToCloudinary } from '../utils/cloudinary.js';
import { APIError } from '../utils/APIError.js';

export const imageUpload = async (req, res) => {
  if (!req.file) throw new APIError(400, 'No file provided');
  const result = await uploadToCloudinary(req.file.path, { folder: 'user_profile_pictures' });
  res.json({ success: true, url: result.secure_url });
};

// Handles image, video, and audio uploads for project media blocks.
// Cloudinary resource_type 'auto' detects the file type automatically.
export const mediaUpload = async (req, res) => {
  if (!req.file) throw new APIError(400, 'No file provided');
  const result = await uploadToCloudinary(req.file.path, { resource_type: 'auto', folder: 'board_media' });

  const audioFormats = new Set(['mp3', 'wav', 'ogg', 'aac']);
  const mediaType = result.resource_type === 'video' && !audioFormats.has(result.format) ? 'video'
    : result.resource_type === 'video' ? 'audio'
    : 'image';

  res.json({ success: true, url: result.secure_url, mediaType, format: result.format });
};
