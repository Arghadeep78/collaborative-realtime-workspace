import Whiteboard from '../models/whiteboardModel.js';
import { Queue } from 'bullmq';

// ── createBoard ───────────────────────────────────────────────────────────────
export const createBoard = async (req, res) => {
  try {
    const { title } = req.body;
    const owner = req.email; // set by authMiddleware

    const board = new Whiteboard({ title: title || 'Untitled Board', owner });
    await board.save();

    return res.status(201).json({ id: board.id, title: board.title, createdAt: board.createdAt });
  } catch (err) {
    console.error('createBoard error:', err);
    return res.status(500).json({ error: 'Failed to create board' });
  }
};

// ── getAllUserBoards ───────────────────────────────────────────────────────────
export const getAllUserBoards = async (req, res) => {
  try {
    const email = req.email;
    const boards = await Whiteboard.find({
      $or: [
        { owner: email },
        { 'collaborators.email': email }
      ]
    }).select('-yjsState').sort({ updatedAt: -1 }).lean();

    return res.status(200).json(boards);
  } catch (err) {
    console.error('getAllUserBoards error:', err);
    return res.status(500).json({ error: 'Failed to fetch boards' });
  }
};

// ── getBoardById ──────────────────────────────────────────────────────────────
// NOTE: This route is intentionally public (no authMiddleware in routes) so
// the frontend can check isPublic before deciding whether to require login.
export const getBoardById = async (req, res) => {
  try {
    const board = await Whiteboard.findOne({ id: req.params.id })
      .select('-yjsState').lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });
    return res.status(200).json(board);
  } catch (err) {
    console.error('getBoardById error:', err);
    return res.status(500).json({ error: 'Failed to fetch board' });
  }
};

// ── deleteBoard ───────────────────────────────────────────────────────────────
export const deleteBoard = async (req, res) => {
  try {
    const board = await Whiteboard.findOne({ id: req.params.id });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner !== req.email) return res.status(403).json({ error: 'Only the owner can delete this board' });

    await board.deleteOne();
    return res.status(200).json({ message: 'Board deleted' });
  } catch (err) {
    console.error('deleteBoard error:', err);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
};

// ── shareBoard ────────────────────────────────────────────────────────────────
// Body: { email: string, name: string, role: 'viewer'|'commenter'|'editor' }
export const shareBoard = async (req, res) => {
  try {
    const { email, name, role = 'editor' } = req.body;
    const board = await Whiteboard.findOne({ id: req.params.id });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner !== req.email) return res.status(403).json({ error: 'Only the owner can share this board' });

    const already = board.collaborators.find(c => c.email === email);
    if (already) {
      already.role = role; // update role if already shared
    } else {
      board.collaborators.push({ email, name: name || email, role });
    }
    await board.save();
    return res.status(200).json({ message: 'Board shared', collaborators: board.collaborators });
  } catch (err) {
    console.error('shareBoard error:', err);
    return res.status(500).json({ error: 'Failed to share board' });
  }
};

// ── unshareBoard ──────────────────────────────────────────────────────────────
// Body: { email: string }
export const unshareBoard = async (req, res) => {
  try {
    const { email } = req.body;
    const board = await Whiteboard.findOne({ id: req.params.id });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner !== req.email) return res.status(403).json({ error: 'Only the owner can manage access' });

    board.collaborators = board.collaborators.filter(c => c.email !== email);
    await board.save();
    return res.status(200).json({ message: 'Access revoked', collaborators: board.collaborators });
  } catch (err) {
    console.error('unshareBoard error:', err);
    return res.status(500).json({ error: 'Failed to revoke access' });
  }
};

// ── updateBoardTitle ──────────────────────────────────────────────────────────
// Body: { title: string }
export const updateBoardTitle = async (req, res) => {
  try {
    const { title } = req.body;
    const board = await Whiteboard.findOne({ id: req.params.id });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const isCollaborator = board.collaborators.some(c => c.email === req.email && c.role === 'editor');
    if (board.owner !== req.email && !isCollaborator) return res.status(403).json({ error: 'Permission denied' });

    board.title = title;
    await board.save();
    return res.status(200).json({ title: board.title });
  } catch (err) {
    console.error('updateBoardTitle error:', err);
    return res.status(500).json({ error: 'Failed to update title' });
  }
};
