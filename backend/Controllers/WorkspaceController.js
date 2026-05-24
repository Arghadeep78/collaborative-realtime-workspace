import Workspace from '../models/workspaceModel.js';
import Whiteboard from '../models/whiteboardModel.js';

// ── createWorkspace ───────────────────────────────────────────────────────────
export const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Workspace name is required' });

    const ws = new Workspace({ name: name.trim(), owner: req.email, members: [] });
    await ws.save();
    return res.status(201).json(wsView(ws));
  } catch (err) {
    console.error('createWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
};

// ── listWorkspaces ────────────────────────────────────────────────────────────
export const listWorkspaces = async (req, res) => {
  try {
    const email = req.email;
    const workspaces = await Workspace.find({
      $or: [{ owner: email }, { 'members.email': email }],
    }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json(workspaces.map(wsView));
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
    return res.status(200).json(wsView(ws));
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

    if (!ws.boardIds.includes(boardId)) {
      ws.boardIds.push(boardId);
      await ws.save();
    }
    return res.status(200).json(wsView(ws));
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
    return res.status(200).json(wsView(ws));
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
    return res.status(200).json(wsView(ws));
  } catch (err) {
    console.error('getOrCreateDefaultWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to get default workspace' });
  }
};

// ── helper ────────────────────────────────────────────────────────────────────
function wsView(ws) {
  const obj = ws.toObject ? ws.toObject() : ws;
  return {
    id:       obj.id,
    name:     obj.name,
    owner:    obj.owner,
    members:  obj.members,
    boardIds: obj.boardIds,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}
