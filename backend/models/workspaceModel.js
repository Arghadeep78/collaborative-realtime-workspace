import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const workspaceSchema = new mongoose.Schema({
  id:   { type: String, default: uuidv4, required: true, unique: true, index: true },
  name: { type: String, required: true },
  owner: { type: String, required: true, index: true }, // email
  // Workspace members get VIEWER access to every board in the workspace by
  // default. Per-board elevation (editor/commenter) lives on the board's
  // `collaborators` array — membership here is just the view-only baseline.
  members: [{
    email:          { type: String, required: true },
    name:           { type: String },
    profilePicture: { type: String, default: null },
  }],
  boardIds: [{ type: String }], // board `id` strings
}, { timestamps: true });

workspaceSchema.index({ 'members.email': 1 });

export default mongoose.model('Workspace', workspaceSchema);
