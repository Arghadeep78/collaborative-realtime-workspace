import Whiteboard from '../models/whiteboard.model.js';
import Workspace from '../models/workspace.model.js';

/**
 * Redis-backed cache for project access metadata.
 *
 * Every Yjs WebSocket connection must validate the connecting user's access
 * (owner / collaborator / public) and resolve their role. Without a cache this
 * means a cold `Whiteboard.findOne()` per connection — a hot path under load.
 * We cache only the small access-control slice (`owner`, `collaborators`,
 * `isPublic`, `publicRole`) under `project:meta:<projectId>` with a short TTL, and
 * invalidate explicitly on share / unshare / publish / unpublish / delete.
 */

const TTL_SECONDS = 60;
const key = (projectId) => `project:meta:${projectId}`;

// Pub/sub channel the Yjs WS server listens on to re-evaluate the role of every
// connected peer the instant a project's access changes (share / unshare /
// role change / workspace membership change). Without this, a demoted editor
// keeps writing — and a revoked collaborator keeps full access — until they
// happen to reload, because the WS connection resolves the role only once at
// connect time.
const accessChannel = (projectId) => `project:access:${projectId}`;

/** @type {import('redis').RedisClientType | null} */
let redis = null;

/** @param {import('redis').RedisClientType} redisClient */
export function initProjectCache(redisClient) {
  redis = redisClient;
}

/**
 * Return the access-control metadata for a project, hitting Redis first and
 * falling back to a lean MongoDB query (which then primes the cache).
 *
 * @param {string} projectId
 * @returns {Promise<{ id: string, owner: string, collaborators: {email:string, role:string}[], isPublic: boolean, publicRole: string } | null>}
 */
export async function getProjectMeta(projectId) {
  if (redis) {
    try {
      const cached = await redis.get(key(projectId));
      if (cached) return JSON.parse(cached);
    } catch {
      // Cache read failure must never break the request — fall through to Mongo.
    }
  }

  const project = await Whiteboard.findOne({ id: projectId })
    .select('id owner collaborators isPublic publicRole revokedEmails')
    .lean();
  if (!project) return null;

  // Members of the workspace this project lives in get a viewer baseline on it.
  const ws = await Workspace.findOne({ boardIds: projectId }).select('owner members').lean();
  const workspaceMembers = ws
    ? [ws.owner, ...(ws.members || []).map((m) => m.email)]
    : [];

  const meta = {
    id: project.id,
    owner: project.owner,
    collaborators: (project.collaborators || []).map((c) => ({ email: c.email, role: c.role })),
    isPublic: Boolean(project.isPublic),
    publicRole: project.publicRole || 'viewer',
    revokedEmails: project.revokedEmails || [],
    workspaceMembers,
  };

  if (redis) {
    redis.set(key(projectId), JSON.stringify(meta), { EX: TTL_SECONDS }).catch(() => {});
  }
  return meta;
}

/**
 * Invalidate a project's cached access metadata AND signal every live Yjs WS
 * connection (on any instance) to re-resolve the connected user's role.
 *
 * Order matters: we delete the cache entry first so the WS server's subsequent
 * `getProjectMeta` re-read misses the cache and pulls the just-written state from
 * MongoDB, then publish the access-change signal. Both are best-effort — a
 * dropped signal self-heals within TTL_SECONDS on the next (re)connect, and a
 * failed delete is covered by the same TTL.
 *
 * @param {string} projectId
 */
export async function invalidateProjectMeta(projectId) {
  if (!redis) return;
  try {
    await redis.del(key(projectId));
  } catch {
    // A stale entry self-heals within TTL_SECONDS; swallow transient Redis errors.
  }
  try {
    await redis.publish(accessChannel(projectId), projectId);
  } catch {
    // A dropped access signal is recovered on the next reconnect; never let it
    // fail the share/unshare request that triggered it.
  }
}

/**
 * Resolve a user's effective role on a project from its cached metadata.
 * Returns `null` when the user has no access at all.
 *
 * @param {{ owner: string, collaborators: {email:string, role:string}[], isPublic: boolean, publicRole: string }} meta
 * @param {string} userEmail
 * @param {('viewer'|'commenter'|'editor'|null)} [shareRole] role from a verified `?st=` share token
 * @returns {'viewer'|'commenter'|'editor'|null}
 */
export function resolveRole(meta, userEmail, shareRole = null) {
  if (!meta) return null;
  if (meta.owner === userEmail) return 'editor';
  const collab = (meta.collaborators || []).find((c) => c.email === userEmail);
  if (collab) return collab.role || 'editor';
  // Explicitly removed by the owner: deny even the workspace-member viewer
  // baseline, a still-valid share token, or public access. Named access
  // (owner/collaborator) is checked first and wins, so re-inviting — which also
  // clears revokedEmails — restores access immediately.
  if (userEmail && (meta.revokedEmails || []).includes(userEmail)) return null;
  if ((meta.workspaceMembers || []).includes(userEmail)) return 'viewer';
  // Signed share link raises a link visitor above the public viewer baseline.
  if (shareRole) return shareRole;
  if (meta.isPublic) return meta.publicRole || 'viewer';
  return null;
}
