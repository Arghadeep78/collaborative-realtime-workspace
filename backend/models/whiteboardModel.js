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

export default mongoose.model("Whiteboard", whiteboardSchema);
