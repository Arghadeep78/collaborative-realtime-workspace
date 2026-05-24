import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const workspaceSchema = new mongoose.Schema({
  id:   { type: String, default: uuidv4, required: true, unique: true, index: true },
  name: { type: String, required: true },
  owner: { type: String, required: true, index: true }, // email
  members: [{
    email: { type: String, required: true },
    role:  { type: String, enum: ['admin', 'member'], default: 'member' },
  }],
  boardIds: [{ type: String }], // board `id` strings
}, { timestamps: true });

workspaceSchema.index({ 'members.email': 1 });

export default mongoose.model('Workspace', workspaceSchema);
