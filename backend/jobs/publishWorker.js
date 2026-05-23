import { Worker } from 'bullmq';
import Whiteboard from '../models/whiteboardModel.js';
import { invalidateBoardMeta } from '../cache/boardCache.js';

const log  = (...a) => console.log('\x1b[35m[Publish Worker]\x1b[0m', ...a);
const lerr = (...a) => console.error('\x1b[35m[Publish Worker]\x1b[0m', ...a);

export function startPublishWorker(redisOpts) {
  const worker = new Worker(
    'publish-board',
    async (job) => {
      const { boardId, role } = job.data;
      log(`Job ${job.id} started → boardId: ${boardId}`);

      const board = await Whiteboard.findOne({ id: boardId });
      if (!board) { log(`Job ${job.id} skipped — board not found`); return; }

      board.isPublic = true;
      if (role) board.publicRole = role;
      await board.save();
      await invalidateBoardMeta(boardId);

      log(`Job ${job.id} completed — boardId: ${boardId} is now public`);
      return { shareUrl: `/board/${boardId}` };
    },
    { connection: redisOpts, concurrency: 5 }
  );

  worker.on('failed', (job, err) => lerr(`Job ${job?.id} failed:`, err.message));
  worker.on('error', (err) => lerr('Worker error:', err?.message || err));
  return worker;
}
