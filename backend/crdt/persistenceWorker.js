import { Worker } from 'bullmq';
import Whiteboard from '../models/whiteboard.model.js';
import { documentManager } from './DocumentManager.js';

const C = '\x1b[36m'; // cyan
const R = '\x1b[0m';  // reset
const log  = (...a) => console.log(`${C}[Persist Worker]${R}`, ...a);
const lerr = (...a) => console.error(`${C}[Persist Worker]${R}`, ...a);

/**
 * Start the BullMQ worker that persists dirty Y.Doc state to MongoDB.
 * Each job carries { projectId }.
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
      const { projectId } = job.data;
      log(`Job ${job.id} started → projectId: ${projectId}`);

      const state = documentManager.encodeState(projectId);
      if (!state) {
        log(`Job ${job.id} skipped — doc evicted`);
        return;
      }

      await Whiteboard.updateOne(
        { id: projectId },
        { $set: { yjsState: Buffer.from(state) } }
      );

      log(`Job ${job.id} completed — persisted projectId: ${projectId} (${state.byteLength}B)`);
    },
    { connection: redisOpts, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    lerr(`Job ${job?.id} failed — projectId: ${job?.data?.projectId}:`, err.message);
    // The scheduler clears the dirty flag when it enqueues, so a failed
    // persist would otherwise be lost until the next edit. Re-mark dirty so
    // the next scheduler tick retries the write.
    if (job?.data?.projectId) documentManager.markDirty(job.data.projectId);
  });

  worker.on('error', (err) => {
    lerr('Worker error:', err?.message || err);
  });

  return worker;
}

