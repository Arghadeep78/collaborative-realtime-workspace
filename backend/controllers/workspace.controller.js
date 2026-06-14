import Workspace from '../models/workspace.model.js';
import Whiteboard from '../models/whiteboard.model.js';
import { invalidateProjectMeta } from '../cache/project.cache.js';
import { wsView } from '../utils/workspace.view.js';
import { lookupUserProfiles } from '../utils/user-profiles.js';
import { isWorkspaceMember } from '../utils/role.js';

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
    // merely contain a project I collaborate on (project-level share — I'll only see
    // that project inside it, filtered client-side).
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
    return res.status(500).json({ error: 'Failed to rename Workspace' });
  }
};

// ── deleteWorkspace ───────────────────────────────────────────────────────────
export const deleteWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can delete this workspace' });

    // Delete the projects in this workspace that the requester owns; projects owned
    // by others (shared into the workspace) are just detached.
    if (ws.boardIds.length) {
      const owned = await Whiteboard.find({ id: { $in: ws.boardIds }, owner: req.email }).select('id').lean();
      const ownedIds = owned.map(b => b.id);
      if (ownedIds.length) {
        await Whiteboard.deleteMany({ id: { $in: ownedIds } });
        await Promise.all(ownedIds.map(id => invalidateProjectMeta(id)));
      }
    }

    await ws.deleteOne();
    return res.status(200).json({ message: 'Workspace deleted' });
  } catch (err) {
    console.error('deleteWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to delete workspace' });
  }
};

// ── addProjectToWorkspace ───────────────────────────────────────────────────────
export const addProjectToWorkspace = async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    const isMember = isWorkspaceMember(ws, req.email);
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this workspace' });

    // Verify the project exists and the requester owns it. Only the owner may file
    // a project into a workspace — adding it detaches the project from any other
    // workspace below, so a mere collaborator must not be able to pull someone
    // else's project out of its owner's workspace.
    const project = await Whiteboard.findOne({ id: projectId }).select('id owner').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) {
      return res.status(403).json({ error: 'Only the project owner can add it to a workspace' });
    }

    // Enforce one-workspace-per-project: remove from any other workspace first
    await Workspace.updateMany(
      { id: { $ne: req.params.id }, boardIds: projectId },
      { $pull: { boardIds: projectId } }
    );

    if (!ws.boardIds.includes(projectId)) {
      ws.boardIds.push(projectId);
      await ws.save();
    }
    // The project's workspace (and thus its viewer baseline) changed.
    await invalidateProjectMeta(projectId);
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('addProjectToWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to add project to workspace' });
  }
};

// ── removeProjectFromWorkspace ──────────────────────────────────────────────────
export const removeProjectFromWorkspace = async (req, res) => {
  try {
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the workspace owner can remove projects' });

    ws.boardIds = ws.boardIds.filter(b => b !== req.params.projectId);
    await ws.save();
    await invalidateProjectMeta(req.params.projectId);
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('removeProjectFromWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to remove project from workspace' });
  }
};

// ── getOrCreateDefaultWorkspace ───────────────────────────────────────────────
// Returns (or auto-creates) the user's first/default workspace.
export const getOrCreateDefaultWorkspace = async (req, res) => {
  try {
    const email = req.email;
    // "Default" = the user's oldest workspace, counting memberships like the rest
    // of the app (listWorkspaces/getAllUserProjects). Prefer one they own, then fall
    // back to one they're a member of, and only auto-create when they have none —
    // otherwise a member-only user gets a redundant empty workspace.
    let ws =
      (await Workspace.findOne({ owner: email }).sort({ createdAt: 1 }).lean()) ||
      (await Workspace.findOne({ 'members.email': email }).sort({ createdAt: 1 }).lean());
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
// Body: { email, name } — grants viewer baseline access to every project in the
// workspace. Per-project elevation is done separately via project sharing.
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
      ws.members.push({ email, name: name || '' });
    }
    await ws.save();

    // Re-sharing with someone previously removed must lift the revocation we
    // recorded on this workspace's projects (removeWorkspaceMember/leaveWorkspace
    // set revokedEmails) — otherwise resolveRole, which checks revokedEmails
    // before the member viewer baseline, would keep them locked out.
    if (ws.boardIds.length) {
      await Whiteboard.updateMany(
        { id: { $in: ws.boardIds }, revokedEmails: email },
        { $pull: { revokedEmails: email } }
      );
    }
    // Membership feeds the project-access cache (viewer baseline) — drop stale entries.
    await Promise.all((ws.boardIds || []).map(id => invalidateProjectMeta(id)));
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('shareWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to share workspace' });
  }
};

// ── removeWorkspaceMember ─────────────────────────────────────────────────────
// Revokes a member's workspace access AND removes their per-project elevations on
// projects in this workspace, so removal fully revokes access.
export const removeWorkspaceMember = async (req, res) => {
  try {
    const { email } = req.params;
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can manage members' });

    ws.members = ws.members.filter(m => m.email !== email);
    await ws.save();

    if (ws.boardIds.length) {
      // Strip the removed member's per-project roles AND record the revocation on
      // every project, so an outstanding share link / public access can't let them
      // back in. Projects they don't own and aren't (no longer) the owner of.
      const projects = await Whiteboard.find({ id: { $in: ws.boardIds }, owner: { $ne: email } });
      await Promise.all(projects.map(b => {
        b.collaborators = b.collaborators.filter(c => c.email !== email);
        if (!b.revokedEmails?.includes(email)) {
          b.revokedEmails = [...(b.revokedEmails || []), email];
        }
        return b.save();
      }));
      // Invalidate every project's cache — the viewer baseline (workspaceMembers) changed.
      await Promise.all(ws.boardIds.map(id => invalidateProjectMeta(id)));
    }
    return res.status(200).json(wsView(ws, req.email));
  } catch (err) {
    console.error('removeWorkspaceMember error:', err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
};

// ── leaveWorkspace ────────────────────────────────────────────────────────────
// Lets a non-owner member remove themselves from a workspace and its projects.
export const leaveWorkspace = async (req, res) => {
  try {
    const email = req.email;
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner === email) return res.status(400).json({ error: 'Owners cannot leave a workspace; delete it instead.' });

    const before = ws.members.length;
    ws.members = ws.members.filter(m => m.email !== email);
    if (ws.members.length === before) return res.status(400).json({ error: 'You are not a member of this workspace.' });

    await ws.save();

    if (ws.boardIds.length) {
      // Drop the leaver's per-project roles AND record the revocation, so a still
      // valid share link / public access can't silently let them back in.
      const projects = await Whiteboard.find({ id: { $in: ws.boardIds }, owner: { $ne: email } });
      await Promise.all(projects.map(b => {
        b.collaborators = b.collaborators.filter(c => c.email !== email);
        if (!b.revokedEmails?.includes(email)) {
          b.revokedEmails = [...(b.revokedEmails || []), email];
        }
        return b.save();
      }));
      await Promise.all(ws.boardIds.map(id => invalidateProjectMeta(id)));
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('leaveWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to leave workspace' });
  }
};

// ── getWorkspaceManageData ────────────────────────────────────────────────────
// Owner-only. Returns the workspace plus every project in it with its
// collaborators, so the management dialog can show/change per-project roles.
export const getWorkspaceManageData = async (req, res) => {
  try {
    const ws = await Workspace.findOne({ id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.owner !== req.email) return res.status(403).json({ error: 'Only the owner can manage this workspace' });

    const projects = ws.boardIds.length
      ? await Whiteboard.find({ id: { $in: ws.boardIds } })
          .select('id title owner collaborators isPublic publicRole').lean()
      : [];

    const allEmails = [
      ws.owner,
      ...ws.members.map(m => m.email),
      ...projects.flatMap(b => b.collaborators?.map(c => c.email) || []),
    ];
    const { nameLookup, photoLookup } = await lookupUserProfiles(allEmails);

    const wsObj = wsView(ws, req.email);
    wsObj.members = ws.members.map(m => ({
      email: m.email,
      name: nameLookup[m.email] || m.name || '',
      profilePicture: photoLookup[m.email] ?? m.profilePicture ?? '',
    }));
    wsObj.ownerProfilePicture = photoLookup[ws.owner] || '';
    wsObj.ownerName = nameLookup[ws.owner] || '';

    return res.status(200).json({
      workspace: wsObj,
      projects: projects.map(b => ({
        id: b.id,
        title: b.title,
        owner: b.owner,
        collaborators: (b.collaborators || []).map(c => ({
          ...c,
          name: nameLookup[c.email] || c.name || '',
          profilePicture: photoLookup[c.email] ?? c.profilePicture ?? '',
        })),
        isPublic: !!b.isPublic,
        publicRole: b.publicRole || 'viewer',
      })),
    });
  } catch (err) {
    console.error('getWorkspaceManageData error:', err);
    return res.status(500).json({ error: 'Failed to load workspace details' });
  }
};

