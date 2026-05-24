import toast from 'react-hot-toast';
import { BACKEND_URL } from '../../constants/apiConfig.js';

/**
 * Upload an image file and return its hosted URL. Reuses the app's existing
 * Cloudinary-backed endpoint (`POST /users/profile/picture`, multipart field
 * `image` → `{ url }`) — the same one the Profile page uses — so board content
 * stores a plain URL string (Yjs/JSON-safe) rather than a bulky data URL.
 */
export async function uploadImage(file) {
  if (!file) return null;
  const token = localStorage.getItem('token');
  const body = new FormData();
  body.append('image', file);
  try {
    const res = await fetch(`${BACKEND_URL}/users/profile/picture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
    return data.url;
  } catch (err) {
    toast.error('Image upload failed');
    throw err;
  }
}
