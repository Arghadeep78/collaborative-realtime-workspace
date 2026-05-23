import express from 'express';
import mongoose from 'mongoose';

/**
 * Liveness / readiness probes for load balancers and Kubernetes.
 *
 *   GET /health  — liveness: is the process up and are its hard dependencies
 *                  (MongoDB, Redis) reachable? Returns 200 when healthy,
 *                  503 when a dependency is down so the LB can pull the node.
 *
 *   GET /ready   — readiness: everything /health checks PLUS whether the
 *                  BullMQ workers are actually running. A node can be "live"
 *                  but not "ready" to take traffic if its background workers
 *                  have died.
 *
 * @param {object}   deps
 * @param {import('redis').RedisClientType} deps.redisClient
 * @param {() => Array<{ isRunning: () => boolean } | null | undefined>} deps.getWorkers
 */
export function createHealthRouter({ redisClient, getWorkers }) {
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
    const ok = mongoOk && redisOk && workersOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ready' : 'not-ready',
      redis: redisOk ? 'connected' : 'disconnected',
      mongo: mongoOk ? 'connected' : 'disconnected',
      workers: workersOk ? 'running' : 'down',
    });
  });

  return router;
}
