import Whiteboard from '../models/whiteboard.model.js';
import Workspace from '../models/workspace.model.js';
import User from '../models/user.model.js';
import { invalidateProjectMeta } from '../cache/project.cache.js';
import { sendProjectInviteEmail } from '../utils/mailer.js';
import { verifyToken } from '../utils/jwt.js';
import { isWorkspaceMember } from '../utils/role.js';

function emailFromAuthHeader(req) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return null;
    return verifyToken(token).email || null;
  } catch {
    return null;
  }
}

// ── createProject ─────────────────────────────────────────────────────────────
export const createProject = async (req, res) => {
  try {
    const { title, thumbnail } = req.body;
    const owner = req.email; // set by authMiddleware

    const project = new Whiteboard({
      title: title || 'Untitled Project',
      owner,
      thumbnail: thumbnail || null
    });
    await project.save();

    return res.status(201).json({ id: project.id, title: project.title, createdAt: project.createdAt, thumbnail: project.thumbnail });
  } catch (err) {
    console.error('createProject error:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
};

// ── getAllUserProjects ─────────────────────────────────────────────────────────
export const getAllUserProjects = async (req, res) => {
  try {
    const email = req.email;

    // Projects I can see by being a member of (or owner of) a workspace — workspace
    // membership grants viewer access to every project in that workspace.
    const myWorkspaces = await Workspace.find({
      $or: [{ owner: email }, { 'members.email': email }],
    }).select('boardIds owner members').lean();
    const memberProjectIds = [...new Set(myWorkspaces.flatMap(w => w.boardIds || []))];
    // Quick lookup: which workspace (membership) covers a given project id.
    const wsByProjectId = new Map();
    myWorkspaces.forEach(w => (w.boardIds || []).forEach(id => {
      if (!wsByProjectId.has(id)) wsByProjectId.set(id, w);
    }));

    const projects = await Whiteboard.find({
      $or: [
        { owner: email },
        { 'collaborators.email': email },
        ...(memberProjectIds.length ? [{ id: { $in: memberProjectIds } }] : []),
      ]
    }).select('-yjsState').sort({ updatedAt: -1 }).lean();

    console.log('[getAllUserProjects] projects found:', projects.map(b => ({ id: b.id, title: b.title })));
    const uncoveredIds = projects.filter(b => !wsByProjectId.has(b.id)).map(b => b.id);
    console.log('[getAllUserProjects] uncoveredIds:', uncoveredIds);
    if (uncoveredIds.length) {
      const extraWs = await Workspace.find({ boardIds: { $in: uncoveredIds } })
        .select('id name owner boardIds').lean();
      extraWs.forEach(w => (w.boardIds || []).forEach(id => {
        if (!wsByProjectId.has(id)) wsByProjectId.set(id, w);
      }));
    }

    const result = projects.map(b => ({
      ...b,
      isFavorited: Array.isArray(b.favoritedBy) && b.favoritedBy.includes(email),
      myRole: Whiteboard.resolveRole(b, email, wsByProjectId.get(b.id)),
      workspaceId:    wsByProjectId.get(b.id)?.id    || null,
      workspaceName:  wsByProjectId.get(b.id)?.name  || null,
      workspaceOwner: wsByProjectId.get(b.id)?.owner || null,
    }));
    return res.status(200).json(result);
  } catch (err) {
    console.error('getAllUserProjects error:', err);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// ── getProjectById ──────────────────────────────────────────────────────────────
// NOTE: This route is intentionally public (no authMiddleware in routes) so
// the frontend can check isPublic before deciding whether to require login.
export const getProjectById = async (req, res) => {
  try {
    const project = await Whiteboard.findOne({ id: req.params.id })
      .select('-yjsState').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const email = emailFromAuthHeader(req);
    // The workspace this project canonically lives in (its owner's workspace).
    const workspace = await Workspace.findOne({ boardIds: project.id })
      .select('id name owner members').lean();
    const shareRole = Whiteboard.verifyShareToken(req.query.st, project.id);
    const myRole = Whiteboard.resolveRole(project, email, workspace, shareRole);

    // Persist the visitor as a collaborator so the project appears on their
    // dashboard. This applies when they arrived via a signed share token OR via
    // a public link (isPublic). Workspace members already appear through the
    // membership query; only strangers who land via a link need recording.
    const grantedRole = shareRole || (project.isPublic ? project.publicRole : null);
    const isWsMember = isWorkspaceMember(workspace, email);
    if (email && grantedRole && myRole && project.owner !== email && !isWsMember) {
      const alreadyIn = project.collaborators?.some(c => c.email === email);
      if (!alreadyIn) {
        const userDoc = await User.findOne({ email }).select('name profilePicture').lean();
        await Whiteboard.updateOne(
          { id: project.id },
          { $push: { collaborators: { email, name: userDoc?.name || email, role: grantedRole, profilePicture: userDoc?.profilePicture || null } } }
        );
        project.collaborators = [...(project.collaborators || []),
          { email, name: userDoc?.name || email, role: grantedRole, profilePicture: userDoc?.profilePicture || null }];
      }
    }

    // Resolve display names for owner + all workspace members in one query.
    const wsMemberEmails = workspace ? [workspace.owner, ...(workspace.members || []).map(m => m.email)] : [project.owner];
    const uniqueEmails = [...new Set(wsMemberEmails)];
    const userDocs = await User.find({ email: { $in: uniqueEmails } }).select('email name profilePicture').lean();
    const nameLookup = Object.fromEntries(userDocs.map(u => [u.email, u.name || u.email]));
    const photoLookup = Object.fromEntries(userDocs.map(u => [u.email, u.profilePicture || '']));

    const workspaceMembers = workspace
      ? [workspace.owner, ...(workspace.members || []).map(m => m.email)].map(e => ({
          email: e,
          name: nameLookup[e] || e,
          profilePicture: photoLookup[e] || '',
        }))
      : [];

    return res.status(200).json({
      ...project,
      ownerName: nameLookup[project.owner] || project.owner,
      myRole,
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, owner: workspace.owner }
        : null,
      workspaceMembers,
    });
  } catch (err) {
    console.error('getProjectById error:', err);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// ── deleteProject ─────────────────────────────────────────────────────────────
export const deleteProject = async (req, res) => {
  try {
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can delete this project' });

    await project.deleteOne();
    await invalidateProjectMeta(project.id);
    return res.status(200).json({ message: 'Project deleted' });
  } catch (err) {
    console.error('deleteProject error:', err);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
};

// ── shareProject ──────────────────────────────────────────────────────────────
// Body: { email: string, name: string, role: 'viewer'|'commenter'|'editor' }
export const shareProject = async (req, res) => {
  try {
    const { email, name, role = 'editor' } = req.body;
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can share this project' });

    const invitee = await User.findOne({ email }).select('name profilePicture').lean();
    const resolvedName = invitee?.name || name || '';
    const resolvedPhoto = invitee?.profilePicture || '';

    // Collapse any pre-existing entries for this email into one before applying
    // the new role. A link-joiner auto-recorded over the WS can race a manual
    // invite and leave two rows for the same person — when that happens, an
    // update that touches only the first row leaves a stale duplicate that wins
    // in the UI (the modal keys participants by email, last-write-wins). Rebuild
    // the list with at most one entry per email so the role always sticks.
    const others = project.collaborators.filter(c => c.email !== email);
    project.collaborators = [
      ...others,
      { email, name: resolvedName, role, profilePicture: resolvedPhoto },
    ];
    // Re-inviting someone the owner previously removed lifts the revocation, so
    // their share-link access works again (and resolveRole stops denying them).
    if (project.revokedEmails?.length) {
      project.revokedEmails = project.revokedEmails.filter(e => e !== email);
    }
    await project.save();
    await invalidateProjectMeta(project.id);

    // Send invite email (fire-and-forget — don't fail the request if email errors)
    sendProjectInviteEmail({
      toEmail: email,
      fromEmail: req.email,
      projectTitle: project.title || 'Untitled Project',
      projectId: project.id,
      role,
    }).catch(err => console.error('shareProject email error:', err));

    return res.status(200).json({ message: 'Project shared', collaborators: project.collaborators });
  } catch (err) {
    console.error('shareProject error:', err);
    return res.status(500).json({ error: 'Failed to share project' });
  }
};

// ── unshareProject ────────────────────────────────────────────────────────────
// Body: { email: string }
export const unshareProject = async (req, res) => {
  try {
    const { email } = req.body;
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can manage access' });

    project.collaborators = project.collaborators.filter(c => c.email !== email);
    // Record the removal so a still-valid share link can't let them back in.
    // The owner can never revoke themselves; workspace members keep their
    // baseline (re-inviting clears this anyway).
    if (email && email !== project.owner && !project.revokedEmails?.includes(email)) {
      project.revokedEmails = [...(project.revokedEmails || []), email];
    }
    await project.save();
    await invalidateProjectMeta(project.id);
    return res.status(200).json({ message: 'Access revoked', collaborators: project.collaborators });
  } catch (err) {
    console.error('unshareProject error:', err);
    return res.status(500).json({ error: 'Failed to revoke access' });
  }
};

// ── createShareToken ──────────────────────────────────────────────────────────
// Owner-only. Mints a signed, 7-day share token granting the given role to
// anyone who opens the project with `?st=<token>`. The bare link (no token)
// continues to give the public viewer baseline, so we also ensure the project is
// at least publicly viewable while share links are in use.
// Body: { role: 'viewer'|'commenter'|'editor' }
export const createShareToken = async (req, res) => {
  try {
    const { role = 'viewer' } = req.body;
    if (!['viewer', 'commenter', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) {
      return res.status(403).json({ error: 'Only the owner can create share links' });
    }

    // Bare link → viewer baseline: turn on public viewer access so a link with
    // no token still opens (read-only). The token elevates above this.
    if (!project.isPublic) {
      project.isPublic = true;
      project.publicRole = 'viewer';
      await project.save();
      await invalidateProjectMeta(project.id);
    }

    const token = Whiteboard.mintShareToken(project.id, role);
    return res.status(200).json({ token, role });
  } catch (err) {
    console.error('createShareToken error:', err);
    return res.status(500).json({ error: 'Failed to create share link' });
  }
};

// ── updateProjectTitle ────────────────────────────────────────────────────────
// Body: { title: string }
// Owner-only: renaming the project is reserved for its owner. Editors can change
// the project's content but not its name (the UI hides the rename for them too).
export const updateProjectTitle = async (req, res) => {
  try {
    const { title } = req.body;
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can rename this project' });

    project.title = title;
    await project.save();
    return res.status(200).json({ title: project.title });
  } catch (err) {
    console.error('updateProjectTitle error:', err);
    return res.status(500).json({ error: 'Failed to update title' });
  }
};

// ── toggleFavorite ────────────────────────────────────────────────────────────
// No body needed — toggles the calling user's favorite status on the project.
export const toggleFavorite = async (req, res) => {
  try {
    const email = req.email;
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const idx = project.favoritedBy.indexOf(email);
    if (idx === -1) project.favoritedBy.push(email);
    else project.favoritedBy.splice(idx, 1);

    await project.save();
    return res.status(200).json({ isFavorited: idx === -1 });
  } catch (err) {
    console.error('toggleFavorite error:', err);
    return res.status(500).json({ error: 'Failed to toggle favorite' });
  }
};

// ── leaveProject ──────────────────────────────────────────────────────────────
// Removes the calling user from project.collaborators. Owners cannot leave
// (they must delete the project or transfer ownership instead).
export const leaveProject = async (req, res) => {
  try {
    const email = req.email;
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner === email) return res.status(400).json({ error: 'Owners cannot leave a project; delete it instead.' });

    const isCollaborator = project.collaborators.some(c => c.email === email);

    // workspaceMembers is not stored on the project — check the actual workspace
    const workspace = await Workspace.findOne({ boardIds: project.id }).select('owner members').lean();
    const isMemberOfWorkspace = isWorkspaceMember(workspace, email);

    if (!isCollaborator && !isMemberOfWorkspace) return res.status(400).json({ error: 'You do not have access to this project.' });

    if (isCollaborator) project.collaborators = project.collaborators.filter(c => c.email !== email);
    // Workspace members need to be revoked explicitly so the workspace baseline no longer grants access
    if (isMemberOfWorkspace && !(project.revokedEmails || []).includes(email)) {
      project.revokedEmails = [...(project.revokedEmails || []), email];
    }

    await project.save();
    await invalidateProjectMeta(project.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('leaveProject error:', err);
    return res.status(500).json({ error: 'Failed to leave project' });
  }
};

// ── updateProjectThumbnail ────────────────────────────────────────────────────
// Body: { thumbnail: string | null }  (CSS gradient string, URL, or base64)
// Owner-only: the cover image is project-level metadata, reserved for the owner
// (the UI hides "Change cover" for non-owners too).
export const updateProjectThumbnail = async (req, res) => {
  try {
    const { thumbnail } = req.body;
    const project = await Whiteboard.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can change the cover' });

    project.thumbnail = thumbnail ?? null;
    await project.save();
    return res.status(200).json({ thumbnail: project.thumbnail });
  } catch (err) {
    console.error('updateProjectThumbnail error:', err);
    return res.status(500).json({ error: 'Failed to update thumbnail' });
  }
};
