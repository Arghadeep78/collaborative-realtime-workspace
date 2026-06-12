import { Worker } from 'bullmq';
import Whiteboard from '../models/whiteboard.model.js';
import { invalidateProjectMeta } from '../cache/project.cache.js';

const log  = (...a) => console.log('\x1b[35m[Publish Worker]\x1b[0m', ...a);
const lerr = (...a) => console.error('\x1b[35m[Publish Worker]\x1b[0m', ...a);

export function startPublishWorker(redisOpts) {
  const worker = new Worker(
    'publish-project',
    async (job) => {
      const { projectId, role } = job.data;
      log(`Job ${job.id} started → projectId: ${projectId}`);

      const project = await Whiteboard.findOne({ id: projectId });
      if (!project) { log(`Job ${job.id} skipped — project not found`); return; }

      project.isPublic = true;
      if (role) project.publicRole = role;
      await project.save();
      await invalidateProjectMeta(projectId);

      log(`Job ${job.id} completed — projectId: ${projectId} is now public`);
      // Client-facing share URL targets the frontend route (still /board/:id).
      return { shareUrl: `/board/${projectId}` };
    },
    { connection: redisOpts, concurrency: 5 }
  );

  worker.on('failed', (job, err) => lerr(`Job ${job?.id} failed:`, err.message));
  worker.on('error', (err) => lerr('Worker error:', err?.message || err));
  return worker;
}
