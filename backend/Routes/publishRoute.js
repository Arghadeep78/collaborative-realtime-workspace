import express from 'express';
import authMiddleware from '../middleware/AuthenticationMIddleware.js';
import Whiteboard from '../models/whiteboardModel.js';
import { getPublishQueue } from '../jobs/publishQueue.js';
import { invalidateBoardMeta } from '../cache/boardCache.js';

const router = express.Router();

// POST /publish/:boardId
router.post('/:boardId', authMiddleware, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { role = 'viewer' } = req.body || {};
    const board = await Whiteboard.findOne({ id: boardId }).lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner !== req.email) return res.status(403).json({ error: 'Only the owner can publish' });

    const queue = getPublishQueue();
    await queue.add('publish', { boardId, role }, {
      jobId: `publish-${boardId}`,
      removeOnComplete: true,
      removeOnFail: 10,
    });

    return res.status(202).json({
      message: 'Board is being published',
      shareUrl: `/board/${boardId}`,
    });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ error: 'Failed to publish board' });
  }
});

// DELETE /publish/:boardId
router.delete('/:boardId', authMiddleware, async (req, res) => {
  try {
    const { boardId } = req.params;
    const board = await Whiteboard.findOne({ id: boardId });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner !== req.email) return res.status(403).json({ error: 'Only the owner can unpublish' });

    board.isPublic = false;
    await board.save();
    await invalidateBoardMeta(boardId);

    return res.status(200).json({ message: 'Board is now private' });
  } catch (err) {
    console.error('unpublish error:', err);
    return res.status(500).json({ error: 'Failed to unpublish board' });
  }
});

export default router;
