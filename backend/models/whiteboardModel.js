import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';

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
  yjsState:   { type: Buffer, default: null },   // binary Yjs snapshot — full board state
  thumbnail:  { type: String, default: null },   // base64 or URL for dashboard preview
  createdAt:  { type: Date, default: Date.now }
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

export default mongoose.model("Whiteboard", whiteboardSchema);
