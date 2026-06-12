import User from '../models/user.model.js';

/**
 * Fetches name and profilePicture for a set of emails.
 * Returns { nameLookup, photoLookup } — both keyed by email.
 */
export async function lookupUserProfiles(emails) {
  const unique = [...new Set(emails)].filter(Boolean);
  if (!unique.length) return { nameLookup: {}, photoLookup: {} };

  const users = await User.find({ email: { $in: unique } })
    .select('email name profilePicture')
    .lean();

  const nameLookup  = Object.fromEntries(users.map(u => [u.email, u.name || '']));
  const photoLookup = Object.fromEntries(users.map(u => [u.email, u.profilePicture || '']));
  return { nameLookup, photoLookup };
}
