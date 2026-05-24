import toast from 'react-hot-toast';
import { BACKEND_URL } from '../../constants/apiConfig.js';

export async function uploadMedia(file) {
  if (!file) return null;
  const token = localStorage.getItem('token');
  const body = new FormData();
  body.append('file', file);
  const toastId = toast.loading('Uploading media…');
  try {
    const res = await fetch(`${BACKEND_URL}/users/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
    toast.success('Uploaded!', { id: toastId });
    return { url: data.url, mediaType: data.mediaType || 'image' };
  } catch (err) {
    toast.error('Media upload failed', { id: toastId });
    throw err;
  }
}
