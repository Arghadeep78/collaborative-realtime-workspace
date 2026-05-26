import { useEffect, useState } from 'react';
import { BACKEND_URL } from '../constants/apiConfig.js';

// Single source of truth for "email -> profile picture URL" across the app.
// The backend (profilePicture field) is authoritative, so resolving by email
// also picks up pictures a user changed in their Profile section. A module-level
// cache is shared by every consumer; misses are batched into one request.

const cache = new Map();        // email -> url ('' means "looked up, none")
const inflight = new Map();     // email -> Promise, dedupes concurrent fetches
const subscribers = new Set();  // () => void, notified when the cache changes

const notify = () => subscribers.forEach((fn) => fn());

const fetchProfiles = (emails) => {
  const token = localStorage.getItem('token');
  return fetch(`${BACKEND_URL}/users/profiles?emails=${emails.map(encodeURIComponent).join(',')}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((r) => (r.ok ? r.json() : []))
    .then((profiles) => {
      profiles.forEach((p) => cache.set(p.email, p.profilePicture || ''));
      // Mark any requested-but-unreturned emails as resolved-empty so we don't refetch forever.
      emails.forEach((e) => { if (!cache.has(e)) cache.set(e, ''); });
      notify();
    })
    .catch(() => {
      // On network error, remove from inflight but don't cache empty —
      // let the next render retry rather than locking out forever.
      emails.forEach((e) => inflight.delete(e));
    });
};

const resolve = (emails) => {
  const missing = emails.filter((e) => e && !cache.has(e) && !inflight.has(e));
  if (!missing.length) return;
  const promise = fetchProfiles(missing).finally(() => missing.forEach((e) => inflight.delete(e)));
  missing.forEach((e) => inflight.set(e, promise));
};

// Seed the cache from data we already trust (own localStorage, peer awareness).
// Keeps the backend authoritative while avoiding needless fetches.
export function primePhotoCache(entries) {
  let changed = false;
  Object.entries(entries || {}).forEach(([email, url]) => {
    if (email && url && cache.get(email) !== url) { cache.set(email, url); changed = true; }
  });
  if (changed) notify();
}

// Resolve photos for a list of emails. Returns { [email]: url } for the ones known so far.
export function useUserPhotos(emails) {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);

  useEffect(() => { resolve(emails); }, [emails.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const out = {};
  emails.forEach((e) => { if (e && cache.get(e)) out[e] = cache.get(e); });
  return out;
}

// Resolve a single email. Returns the url or '' if unknown/none.
export function useUserPhoto(email) {
  return useUserPhotos(email ? [email] : [])[email] || '';
}
