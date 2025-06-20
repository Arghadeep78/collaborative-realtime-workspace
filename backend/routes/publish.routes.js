import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import Whiteboard from '../models/whiteboard.model.js';
import { invalidateProjectMeta } from '../cache/project.cache.js';
import { validate, fields, optional } from '../middleware/validate.middleware.js';
import { APIError } from '../utils/APIError.js';
import { sendResponse } from '../utils/sendResponse.js';

const router = express.Router();

// POST /publish/:projectId
router.post('/:projectId', authMiddleware, validate({ role: optional(fields.shareRole) }), async (req, res) => {
  const { projectId } = req.params;
  const { role = 'viewer' } = req.body || {};
  const project = await Whiteboard.findOne({ id: projectId });
  if (!project) throw new APIError(404, 'Project not found');
  if (project.owner !== req.email) throw new APIError(403, 'Only the owner can publish');

  project.isPublic = true;
  project.publicRole = role;
  await project.save();
  await invalidateProjectMeta(projectId);

  return sendResponse(res, 200, 'Project is now public', {
    // Client-facing share URL targets the frontend route (still /board/:id).
    shareUrl: `/board/${projectId}`,
  });
});

// DELETE /publish/:projectId
router.delete('/:projectId', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const project = await Whiteboard.findOne({ id: projectId });
  if (!project) throw new APIError(404, 'Project not found');
  if (project.owner !== req.email) throw new APIError(403, 'Only the owner can unpublish');

  project.isPublic = false;
  await project.save();
  await invalidateProjectMeta(projectId);

  return sendResponse(res, 200, 'Project is now private');
});

export default router;
