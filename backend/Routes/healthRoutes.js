import express from 'express';
import mongoose from 'mongoose';

// Persist queue backlog above this means the worker pool is falling behind —
// edits are being made faster than they're flushed to MongoDB. The node is
// still "live" but reporting not-ready lets an orchestrator stop sending it new
// load until it drains, rather than piling on more boards to persist.
const PERSIST_BACKLOG_THRESHOLD = 100;

/**
 * Liveness / readiness probes for load balancers and Kubernetes.
 *
 *   GET /health  — liveness: is the process up and are its hard dependencies
 *                  (MongoDB, Redis) reachable? Returns 200 when healthy,
 *                  503 when a dependency is down so the LB can pull the node.
 *
 *   GET /ready   — readiness: everything /health checks PLUS whether the
 *                  BullMQ workers are running, the persist queue isn't
 *                  backed up, and a snapshot of how many boards are live in
 *                  memory. A node can be "live" but not "ready" to take traffic
 *                  if its background workers have died or it's saturated.
 *
 * @param {object}   deps
 * @param {import('redis').RedisClientType} deps.redisClient
 * @param {() => Array<{ isRunning: () => boolean } | null | undefined>} deps.getWorkers
 * @param {import('bullmq').Queue} [deps.persistQueue]  - yjs-persist queue, for backpressure check
 * @param {{ docs: Map<string, unknown> }} [deps.documentManager]  - for active-board count
 */
export function createHealthRouter({ redisClient, getWorkers, persistQueue, documentManager }) {
  const router = express.Router();

  const checkMongo = () => mongoose.connection.readyState === 1;

  const checkRedis = async () => {
    try {
      return (await redisClient.ping()) === 'PONG';
    } catch {
      return false;
    }
  };

  router.get('/health', async (req, res) => {
    const [mongoOk, redisOk] = [checkMongo(), await checkRedis()];
    const ok = mongoOk && redisOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      redis: redisOk ? 'connected' : 'disconnected',
      mongo: mongoOk ? 'connected' : 'disconnected',
    });
  });

  router.get('/ready', async (req, res) => {
    const [mongoOk, redisOk] = [checkMongo(), await checkRedis()];
    const workers = getWorkers ? getWorkers() : [];
    const workersOk = workers.length > 0 && workers.every((w) => Boolean(w) && w.isRunning());

    // Persist-queue backpressure: count jobs waiting to flush to MongoDB.
    // A growing backlog signals the worker pool can't keep up with edit volume.
    let persistBacklog = null;
    let backpressureOk = true;
    if (persistQueue) {
      try {
        persistBacklog = await persistQueue.getWaitingCount();
        backpressureOk = persistBacklog <= PERSIST_BACKLOG_THRESHOLD;
      } catch {
        backpressureOk = false; // can't read the queue → can't vouch for readiness
      }
    }

    const activeBoards = documentManager ? documentManager.docs.size : null;

    const ok = mongoOk && redisOk && workersOk && backpressureOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ready' : 'not-ready',
      redis: redisOk ? 'connected' : 'disconnected',
      mongo: mongoOk ? 'connected' : 'disconnected',
      workers: workersOk ? 'running' : 'down',
      persistBacklog,
      backpressure: backpressureOk ? 'ok' : 'saturated',
      activeBoards,
    });
  });

  return router;
}
