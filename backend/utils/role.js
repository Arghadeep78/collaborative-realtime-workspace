/**
 * Canonical role resolution and workspace-membership logic.
 * Both the HTTP path (Whiteboard model static) and the WS path (project cache)
 * delegate here so the authorization precedence is defined in exactly one place.
 */

/**
 * Resolve a user's effective role on a project.
 *
 * Expects a normalized `meta` object:
 *   - owner: string
 *   - collaborators: { email: string, role: string }[]
 *   - revokedEmails: string[]
 *   - workspaceMembers: string[]   (flat list of emails — owner + member emails)
 *   - isPublic: boolean
 *   - publicRole: string
 *
 * Precedence (highest → lowest):
 *   owner → named collaborator → revoked (deny) → workspace member viewer
 *   → share-link role → public role → null (no access)
 *
 * @param {object} meta
 * @param {string|null} email
 * @param {string|null} shareRole - role granted by a verified ?st= share token
 * @returns {'owner'|'editor'|'commenter'|'viewer'|null}
 */
export function resolveRole(meta, email, shareRole = null) {
  if (!meta) return null;
  if (email && meta.owner === email) return 'owner';
  const collab = email && (meta.collaborators || []).find(c => c.email === email);
  if (collab) return collab.role || 'editor';
  if (email && (meta.revokedEmails || []).includes(email)) return null;
  if (email && (meta.workspaceMembers || []).includes(email)) return 'viewer';
  if (shareRole) return shareRole;
  if (meta.isPublic) return meta.publicRole || 'viewer';
  return null;
}

/**
 * Returns true if `email` is the owner or a member of `workspace`.
 * Handles both Mongoose doc shape ({ owner, members: [{email}] }) and plain objects.
 *
 * @param {{ owner: string, members: { email: string }[] }|null} workspace
 * @param {string|null} email
 * @returns {boolean}
 */
export function isWorkspaceMember(workspace, email) {
  if (!workspace || !email) return false;
  return workspace.owner === email || (workspace.members || []).some(m => m.email === email);
}
