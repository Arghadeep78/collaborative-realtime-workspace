import jwt from 'jsonwebtoken';
import Whiteboard from '../models/whiteboardModel.js';
import Workspace from '../models/workspaceModel.js';
import { invalidateBoardMeta } from '../cache/boardCache.js';
import { sendBoardInviteEmail } from '../utils/mailer.js';

// Decode a Bearer token without rejecting the request when it's missing/invalid.
// getBoardById is intentionally public, but we still want the caller's identity
// (when present) to resolve their effective role on the board.
function emailFromAuthHeader(req) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET).email || null;
  } catch {
    return null;
  }
}

// Resolve a user's effective role on a board. Precedence:
//   owner → explicit board collaborator → workspace-member viewer baseline →
//   public link role → no access (null).
function resolveRole(board, email, workspace) {
  if (email && board.owner === email) return 'owner';
  const collab = email && board.collaborators?.find(c => c.email === email);
  if (collab) return collab.role;
  const isWsMember = email && workspace &&
    (workspace.owner === email || workspace.members?.some(m => m.email === email));
  if (isWsMember) return 'viewer';
  if (board.isPublic) return board.publicRole || 'viewer';
  return null;
}

// ── createBoard ───────────────────────────────────────────────────────────────
export const createBoard = async (req, res) => {
  try {
    const { title, thumbnail } = req.body;
    const owner = req.email; // set by authMiddleware

    const board = new Whiteboard({ 
      title: title || 'Untitled Board', 
      owner,
      thumbnail: thumbnail || null
    });
    await board.save();

    return res.status(201).json({ id: board.id, title: board.title, createdAt: board.createdAt, thumbnail: board.thumbnail });
  } catch (err) {
    console.error('createBoard error:', err);
    return res.status(500).json({ error: 'Failed to create board' });
  }
};

// ── getAllUserBoards ───────────────────────────────────────────────────────────
export const getAllUserBoards = async (req, res) => {
  try {
    const email = req.email;

    // Boards I can see by being a member of (or owner of) a workspace — workspace
    // membership grants viewer access to every board in that workspace.
    const myWorkspaces = await Workspace.find({
      $or: [{ owner: email }, { 'members.email': email }],
    }).select('boardIds owner members').lean();
    const memberBoardIds = [...new Set(myWorkspaces.flatMap(w => w.boardIds || []))];
    // Quick lookup: which workspace (membership) covers a given board id.
    const wsByBoardId = new Map();
    myWorkspaces.forEach(w => (w.boardIds || []).forEach(id => {
      if (!wsByBoardId.has(id)) wsByBoardId.set(id, w);
    }));

    const boards = await Whiteboard.find({
      $or: [
        { owner: email },
        { 'collaborators.email': email },
        ...(memberBoardIds.length ? [{ id: { $in: memberBoardIds } }] : []),
      ]
    }).select('-yjsState').sort({ updatedAt: -1 }).lean();

    const result = boards.map(b => ({
      ...b,
      isFavorited: Array.isArray(b.favoritedBy) && b.favoritedBy.includes(email),
      myRole: resolveRole(b, email, wsByBoardId.get(b.id)),
    }));
    return res.status(200).json(result);
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

    const email = emailFromAuthHeader(req);
    // The workspace this board canonically lives in (its owner's workspace).
    const workspace = await Workspace.findOne({ boardIds: board.id })
      .select('id name owner members').lean();
    const myRole = resolveRole(board, email, workspace);

    return res.status(200).json({
      ...board,
      myRole,
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, owner: workspace.owner }
        : null,
    });
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
    await invalidateBoardMeta(board.id);
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
    await invalidateBoardMeta(board.id);

    // Send invite email (fire-and-forget — don't fail the request if email errors)
    sendBoardInviteEmail({
      toEmail: email,
      fromEmail: req.email,
      boardTitle: board.title || 'Untitled Board',
      boardId: board.id,
      role,
    }).catch(err => console.error('shareBoard email error:', err));

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
    await invalidateBoardMeta(board.id);
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

// ── toggleFavorite ────────────────────────────────────────────────────────────
// No body needed — toggles the calling user's favorite status on the board.
export const toggleFavorite = async (req, res) => {
  try {
    const email = req.email;
    const board = await Whiteboard.findOne({ id: req.params.id });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const idx = board.favoritedBy.indexOf(email);
    if (idx === -1) board.favoritedBy.push(email);
    else board.favoritedBy.splice(idx, 1);

    await board.save();
    return res.status(200).json({ isFavorited: idx === -1 });
  } catch (err) {
    console.error('toggleFavorite error:', err);
    return res.status(500).json({ error: 'Failed to toggle favorite' });
  }
};

// ── updateBoardThumbnail ──────────────────────────────────────────────────────
// Body: { thumbnail: string | null }  (CSS gradient string, URL, or base64)
export const updateBoardThumbnail = async (req, res) => {
  try {
    const { thumbnail } = req.body;
    const board = await Whiteboard.findOne({ id: req.params.id });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const isCollaborator = board.collaborators.some(c => c.email === req.email && c.role === 'editor');
    if (board.owner !== req.email && !isCollaborator) return res.status(403).json({ error: 'Permission denied' });

    board.thumbnail = thumbnail ?? null;
    await board.save();
    return res.status(200).json({ thumbnail: board.thumbnail });
  } catch (err) {
    console.error('updateBoardThumbnail error:', err);
    return res.status(500).json({ error: 'Failed to update thumbnail' });
  }
};
