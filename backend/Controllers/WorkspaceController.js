import Workspace from '../models/workspaceModel.js';
import Whiteboard from '../models/whiteboardModel.js';
import { invalidateBoardMeta } from '../cache/boardCache.js';

// ── createWorkspace ───────────────────────────────────────────────────────────
export const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Workspace name is required' });

    const ws = new Workspace({ name: name.trim(), owner: req.email, members: [] });
    await ws.save();
    return res.status(201).json(wsView(ws, req.email));
  } catch (err) {
    console.error('createWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
};

// ── listWorkspaces ────────────────────────────────────────────────────────────
export const listWorkspaces = async (req, res) => {
  try {
    const email = req.email;
    // Workspaces visible to me: ones I own, ones I'm a member of, and ones that
    // merely contain a board I collaborate on (board-level share — I'll only see
    // that board inside it, filtered client-side).
    const myBoardIds = (
      await Whiteboard.find({ 'collaborators.email': email }).select('id').lean()
    ).map(b => b.id);

    const workspaces = await Workspace.find({
      $or: [
        { owner: email },
        { 'members.email': email },
        ...(myBoardIds.length ? [{ boardIds: { $in: myBoardIds } }] : []),
      ],
    }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json(workspaces.map(ws => wsView(ws, email)));
  } catch (err) {
    console.error('listWorkspaces error:', err);
    return res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
};

// ── renameWorkspace ───────────────────────────────────────────────────────────
export const renameWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can rename this workspace' });

    ws.name = name.trim();
    await ws.save();
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('renameWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to rename workspace' });
  }
};

// ── deleteWorkspace ───────────────────────────────────────────────────────────
export const deleteWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can delete this workspace' });

    // Delete the boards in this workspace that the requester owns; boards owned
    // by others (shared into the workspace) are just detached.
    if (ws.boardIds.length) {
      const owned = await Whiteboard.find({ id: { $in: ws.boardIds }, owner: req.email }).select('id').lean();
      const ownedIds = owned.map(b => b.id);
      if (ownedIds.length) {
        await Whiteboard.deleteMany({ id: { $in: ownedIds } });
        await Promise.all(ownedIds.map(id => invalidateBoardMeta(id)));
      }
    }

    await ws.deleteOne();
    return res.status(200).json({ message: 'Workspace deleted' });
  } catch (err) {
    console.error('deleteWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to delete workspace' });
  }
};

// ── addBoardToWorkspace ───────────────────────────────────────────────────────
export const addBoardToWorkspace = async (req, res) => {
  try {
    const { boardId } = req.body;
    if (!boardId) return res.status(400).json({ error: 'boardId is required' });

    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    const isMember = ws.owner === req.email || ws.members.some(m => m.email === req.email);
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this workspace' });

    // Verify the board exists and requester has access
    const board = await Whiteboard.findOne({ id: boardId }).select('id owner collaborators').lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const hasAccess = board.owner === req.email || board.collaborators.some(c => c.email === req.email);
    if (!hasAccess) return res.status(403).json({ error: 'You do not have access to this board' });

    // Enforce one-workspace-per-board: remove from any other workspace first
    await Workspace.updateMany(
      { id: { $ne: req.params.id }, boardIds: boardId },
      { $pull: { boardIds: boardId } }
    );

    if (!ws.boardIds.includes(boardId)) {
      ws.boardIds.push(boardId);
      await ws.save();
    }
    // The board's workspace (and thus its viewer baseline) changed.
    await invalidateBoardMeta(boardId);
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('addBoardToWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to add board to workspace' });
  }
};

// ── removeBoardFromWorkspace ──────────────────────────────────────────────────
export const removeBoardFromWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    const isMember = ws.owner === req.email || ws.members.some(m => m.email === req.email);
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this workspace' });

    ws.boardIds = ws.boardIds.filter(b => b !== req.params.boardId);
    await ws.save();
    await invalidateBoardMeta(req.params.boardId);
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('removeBoardFromWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to remove board from workspace' });
  }
};

// ── getOrCreateDefaultWorkspace ───────────────────────────────────────────────
// Returns (or auto-creates) the user's first/default workspace.
export const getOrCreateDefaultWorkspace = async (req, res) => {
  try {
    const email = req.email;
    let ws = await Workspace.findOne({ owner: email }).sort({ createdAt: 1 }).lean();
    if (!ws) {
      const name = req.body?.defaultName || `My Workspace`;
      const created = new Workspace({ name, owner: email, members: [] });
      await created.save();
      ws = created.toObject();
    }
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('getOrCreateDefaultWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to get default workspace' });
  }
};

// ── shareWorkspace ────────────────────────────────────────────────────────────
// Body: { email, name } — grants viewer baseline access to every board in the
// workspace. Per-board elevation is done separately via board sharing.
export const shareWorkspace = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can share this workspace' });
    if (email === ws.owner) return res.status(400).json({ error: 'The owner already has access' });

    const existing = ws.members.find(m => m.email === email);
    if (existing) {
      if (name) existing.name = name;
    } else {
      ws.members.push({ email, name: name || email });
    }
    await ws.save();
    // Membership feeds the board-access cache (viewer baseline) — drop stale entries.
    await Promise.all((ws.boardIds || []).map(id => invalidateBoardMeta(id)));
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('shareWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to share workspace' });
  }
};

// ── removeWorkspaceMember ─────────────────────────────────────────────────────
// Revokes a member's workspace access AND removes their per-board elevations on
// boards in this workspace, so removal fully revokes access.
export const removeWorkspaceMember = async (req, res) => {
  try {
    const { email } = req.params;
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can manage members' });

    ws.members = ws.members.filter(m => m.email !== email);
    await ws.save();

    if (ws.boardIds.length) {
      const boards = await Whiteboard.find({ id: { $in: ws.boardIds }, 'collaborators.email': email });
      await Promise.all(boards.map(b => {
        b.collaborators = b.collaborators.filter(c => c.email !== email);
        return b.save();
      }));
      // Invalidate every board's cache — the viewer baseline (workspaceMembers) changed.
      await Promise.all(ws.boardIds.map(id => invalidateBoardMeta(id)));
    }
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('removeWorkspaceMember error:', err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
};

// ── getWorkspaceManageData ────────────────────────────────────────────────────
// Owner-only. Returns the workspace plus every board in it with its
// collaborators, so the management dialog can show/change per-board roles.
export const getWorkspaceManageData = async (req, res) => {
  try {
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can manage this workspace' });

    const boards = ws.boardIds.length
      ? await Whiteboard.find({ id: { $in: ws.boardIds } })
          .select('id title owner collaborators isPublic publicRole').lean()
      : [];

    return res.status(200).json({
      workspace: wsView(ws, req.email),
      boards: boards.map(b => ({
        id: b.id,
        title: b.title,
        owner: b.owner,
        collaborators: b.collaborators || [],
        isPublic: !!b.isPublic,
        publicRole: b.publicRole || 'viewer',
      })),
    });
  } catch (err) {
    console.error('getWorkspaceManageData error:', err);
    return res.status(500).json({ error: 'Failed to load workspace details' });
  }
};

// ── helper ────────────────────────────────────────────────────────────────────
function wsView(ws, email) {
  const obj = ws.toObject ? ws.toObject() : ws;
  return {
    id:       obj.id,
    name:     obj.name,
    owner:    obj.owner,
    isOwner:  email != null ? obj.owner === email : undefined,
    members:  obj.members,
    boardIds: obj.boardIds,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}
