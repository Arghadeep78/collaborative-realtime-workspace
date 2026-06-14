import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import Whiteboard from '../models/whiteboard.model.js';
import { invalidateProjectMeta } from '../cache/project.cache.js';

const router = express.Router();

// POST /publish/:projectId
router.post('/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { role = 'viewer' } = req.body || {};
    const project = await Whiteboard.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can publish' });

    project.isPublic = true;
    project.publicRole = role;
    await project.save();
    await invalidateProjectMeta(projectId);

    return res.status(200).json({
      message: 'Project is now public',
      // Client-facing share URL targets the frontend route (still /board/:id).
      shareUrl: `/board/${projectId}`,
    });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ error: 'Failed to publish project' });
  }
});

// DELETE /publish/:projectId
router.delete('/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Whiteboard.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner !== req.email) return res.status(403).json({ error: 'Only the owner can unpublish' });

    project.isPublic = false;
    await project.save();
    await invalidateProjectMeta(projectId);

    return res.status(200).json({ message: 'Project is now private' });
  } catch (err) {
    console.error('unpublish error:', err);
    return res.status(500).json({ error: 'Failed to unpublish project' });
  }
});

export default router;
