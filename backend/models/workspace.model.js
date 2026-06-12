import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const workspaceSchema = new mongoose.Schema({
  id:   { type: String, default: uuidv4, required: true, unique: true, index: true },
  name: { type: String, required: true },
  owner: { type: String, required: true, index: true }, // email
  // Workspace members get VIEWER access to every project in the workspace by
  // default. Per-project elevation (editor/commenter) lives on the project's
  // `collaborators` array — membership here is just the view-only baseline.
  members: [{
    email:          { type: String, required: true },
    name:           { type: String },
    profilePicture: { type: String, default: null },
  }],
  boardIds: [{ type: String }], // project `id` strings (DB field kept as `boardIds` to avoid migration)
}, { timestamps: true });

workspaceSchema.index({ 'members.email': 1 });

export default mongoose.model('Workspace', workspaceSchema);
