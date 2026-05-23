import { Worker } from 'bullmq';
import Whiteboard from '../models/whiteboardModel.js';
import { documentManager } from './DocumentManager.js';

const C = '\x1b[36m'; // cyan
const R = '\x1b[0m';  // reset
const log  = (...a) => console.log(`${C}[Persist Worker]${R}`, ...a);
const lerr = (...a) => console.error(`${C}[Persist Worker]${R}`, ...a);

/**
 * Start the BullMQ worker that persists dirty Y.Doc state to MongoDB.
 * Each job carries { boardId }.
 * The worker:
 *   1. Reads the in-memory Y.Doc via DocumentManager
 *   2. Encodes binary state  (yjsState)
 *   3. Writes it to MongoDB in a single update
 *
 * @param {import('ioredis').RedisOptions} redisOpts - ioredis connection options for BullMQ
 */
export function startPersistenceWorker(redisOpts) {
  const worker = new Worker(
    'yjs-persist',
    async (job) => {
      const { boardId } = job.data;
      log(`Job ${job.id} started → boardId: ${boardId}`);

      const state = documentManager.encodeState(boardId);
      if (!state) {
        log(`Job ${job.id} skipped — doc evicted`);
        return;
      }

      await Whiteboard.updateOne(
        { id: boardId },
        { $set: { yjsState: Buffer.from(state) } }
      );

      log(`Job ${job.id} completed — persisted boardId: ${boardId} (${state.byteLength}B)`);
    },
    { connection: redisOpts, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    lerr(`Job ${job?.id} failed — boardId: ${job?.data?.boardId}:`, err.message);
    // The scheduler clears the dirty flag when it enqueues, so a failed
    // persist would otherwise be lost until the next edit. Re-mark dirty so
    // the next scheduler tick retries the write.
    if (job?.data?.boardId) documentManager.markDirty(job.data.boardId);
  });

  worker.on('error', (err) => {
    lerr('Worker error:', err?.message || err);
  });

  return worker;
}

