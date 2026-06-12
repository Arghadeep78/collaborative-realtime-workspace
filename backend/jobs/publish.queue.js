import { Queue } from 'bullmq';

let publishQueue = null;

export function initPublishQueue(redisOpts) {
  publishQueue = new Queue('publish-project', { connection: redisOpts });
  publishQueue.on('error', (err) => {
    console.error('[Publish Queue] Error:', err?.message || err);
  });
  return publishQueue;
}

export function getPublishQueue() {
  if (!publishQueue) throw new Error('Publish queue not initialized');
  return publishQueue;
}
