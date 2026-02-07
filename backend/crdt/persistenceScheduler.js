import { Queue } from 'bullmq';
import { documentManager } from './DocumentManager.js';

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

const C = '\x1b[36m'; // cyan
const R = '\x1b[0m';  // reset
const log  = (...a) => console.log(`${C}[Persist Scheduler]${R}`, ...a);
const lerr = (...a) => console.error(`${C}[Persist Scheduler]${R}`, ...a);

/**
 * Start the periodic scheduler that checks for dirty Y.Docs
 * and enqueues BullMQ jobs to persist them to MongoDB.
 *
 * @param {import('ioredis').RedisOptions} redisOpts
 * @returns {{ queue: Queue, stop: () => void }}
 */
export function startPersistenceScheduler(redisOpts) {
  const queue = new Queue('yjs-persist', { connection: redisOpts });
  log(`Started — flush interval: ${FLUSH_INTERVAL_MS / 1000}s`);

  queue.on('error', (err) => {
    lerr('Queue error:', err?.message || err);
  });

  const intervalId = setInterval(async () => {
    const dirtyIds = documentManager.flushDirtyIds();

    if (dirtyIds.length === 0) return; // silent skip — no dirty docs

    log(`Tick — ${dirtyIds.length} dirty doc(s) found → [${dirtyIds.join(', ')}]`);

    let enqueued = 0;
    for (const boardId of dirtyIds) {
      try {
        await queue.add('persist', { boardId }, {
          // De-duplicate: if a job for this board is already waiting, skip
          jobId: `persist-${boardId}`,
          removeOnComplete: true,
          removeOnFail: 50,
        });
        enqueued++;
      } catch (err) {
        lerr(`Failed to enqueue job for boardId: ${boardId} —`, err.message);
      }
    }

    log(`Enqueued ${enqueued}/${dirtyIds.length} persist job(s)`);
  }, FLUSH_INTERVAL_MS);

  const stop = () => {
    clearInterval(intervalId);
    queue.close();
    log('Stopped');
  };

  return { queue, stop };
}

