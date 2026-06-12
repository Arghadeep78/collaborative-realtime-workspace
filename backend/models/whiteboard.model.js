import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const whiteboardSchema = new mongoose.Schema({
  id:    { type: String, default: uuidv4, required: true, unique: true, index: true },
  title: { type: String, required: true },
  owner: { type: String, required: true, index: true }, // stores email
  collaborators: [{
    email:          { type: String },
    name:           { type: String },
    role:           { type: String, enum: ['viewer', 'commenter', 'editor'], default: 'editor' },
    profilePicture: { type: String, default: null }
  }],
  isPublic:   { type: Boolean, default: false },
  publicRole: { type: String, enum: ['viewer', 'commenter', 'editor'], default: 'viewer' },
  // Emails the owner has explicitly removed. A share link (`?st=`) otherwise
  // keeps granting access to anyone who still holds it, so removal alone can't
  // evict a link-joiner — we deny these emails even when they present a valid
  // token. Re-inviting an email clears it from this list.
  revokedEmails: [{ type: String }],
  yjsState:   { type: Buffer, default: null },   // binary Yjs snapshot — full board state
  thumbnail:   { type: String, default: null },   // base64 or URL for dashboard preview
  favoritedBy: [{ type: String }],               // emails of users who favorited this board
  createdAt:   { type: Date, default: Date.now }
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
//
// getAllUserBoards runs:
//   $or: [{ owner: email }, { 'collaborators.email': email }]
//   .sort({ updatedAt: -1 })
//
// MongoDB resolves each $or arm independently then merges.  Without an index on
// collaborators.email the second arm is a full collection scan, making the query
// O(N) as the board count grows.
//
// Index 1 — collaborators.email:
//   Lets MongoDB satisfy the second $or arm with an index scan instead of a
//   collection scan.  A multikey index on an array field is exactly what MongoDB
//   builds here — one index entry per collaborator per document.
whiteboardSchema.index({ 'collaborators.email': 1 });

// Index 2 — owner + updatedAt:
//   Compound index for the first $or arm.  The owner prefix filters by user;
//   the descending updatedAt lets MongoDB return the owner's boards in dashboard
//   order without a separate in-memory sort.  Use { owner: 1, updatedAt: -1 }
//   rather than a plain { owner: 1 } so the sort direction is covered by the
//   index.  (The $or merge still requires a final SORT across both arms, but
//   each arm's candidate set is already ordered, which MongoDB can exploit.)
whiteboardSchema.index({ owner: 1, updatedAt: -1 });

// ── Statics ───────────────────────────────────────────────────────────────────

// Resolve a user's effective role on a board. Precedence:
//   owner → explicit board collaborator → workspace-member viewer baseline →
//   signed share-link role → public link role → no access (null).
// Named access always wins, so opening a viewer link never downgrades a real
// editor; the share-link role only ever *raises* access for a link visitor.
whiteboardSchema.statics.resolveRole = function (board, email, workspace, shareRole = null) {
  if (email && board.owner === email) return 'owner';
  const collab = email && board.collaborators?.find(c => c.email === email);
  if (collab) return collab.role;
  // Explicitly removed by the owner: deny even the workspace-member viewer
  // baseline, a still-valid share token, or public access. Named access above
  // wins, so re-inviting (which clears revokedEmails) restores access.
  if (email && board.revokedEmails?.includes(email)) return null;
  const isWsMember = email && workspace &&
    (workspace.owner === email || workspace.members?.some(m => m.email === email));
  if (isWsMember) return 'viewer';
  if (shareRole) return shareRole;
  if (board.isPublic) return board.publicRole || 'viewer';
  return null;
};

// Mint a signed 7-day share token granting the given role to anyone who
// presents it as `?st=<token>` on this board.
whiteboardSchema.statics.mintShareToken = function (boardId, role) {
  return jwt.sign(
    { boardId, shareRole: role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify a signed share token and return the role it grants for the given
// boardId — or null if missing / invalid / expired / for a different board.
whiteboardSchema.statics.verifyShareToken = function (token, boardId) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.boardId !== boardId) return null;
    return ['viewer', 'commenter', 'editor'].includes(decoded.shareRole)
      ? decoded.shareRole
      : null;
  } catch {
    return null;
  }
};

export default mongoose.model("Whiteboard", whiteboardSchema);
