import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { createClient } from "redis";
dotenv.config();
import { connectToDatabase } from "./db.js";
import userRoute from "./Routes/userRoute.js";
import boardRoute from "./Routes/boardRoutes.js";
import aiRoutes from "./Routes/aiRoutes.js";
import { setupYjsWSServer } from "./crdt/WSServer.js";
import { startPersistenceWorker } from "./crdt/persistenceWorker.js";
import { startPersistenceScheduler } from "./crdt/persistenceScheduler.js";
import publishRoute from "./Routes/publishRoute.js";
import workspaceRoute from "./Routes/workspaceRoutes.js";
import { startPublishWorker } from "./jobs/publishWorker.js";
import { initPublishQueue } from "./jobs/publishQueue.js";
import { initBoardCache } from "./cache/boardCache.js";
import { createRateLimiters } from "./middleware/rateLimiters.js";
import { createHealthRouter } from "./Routes/healthRoutes.js";

const PORT = process.env.PORT || 3030;

function normalizeOrigin(value = "") {
  return value.trim().replace(/\/$/, "");
}

function parseAllowedOrigins() {
  const fromFrontendUrl = (process.env.FRONTEND_URL || "").split(",");
  const fromFrontendUrls = (process.env.FRONTEND_URLS || "").split(",");

  return [...fromFrontendUrl, ...fromFrontendUrls, "http://localhost:5173"]
    .map(normalizeOrigin)
    .filter(Boolean);
}

/** Parse a redis[s]:// URL into ioredis-compatible options for BullMQ. */
function parseRedisUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username || undefined,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null, // required by BullMQ
  };
}

async function ensureRedisNoEviction(client) {
  try {
    const current = await client.configGet('maxmemory-policy');
    const policy = Array.isArray(current)
      ? current[1]
      : current?.['maxmemory-policy'];

    if (policy !== 'noeviction') {
      await client.configSet('maxmemory-policy', 'noeviction');
      console.log('✅ Redis maxmemory-policy set to noeviction');
    } else {
      console.log('✅ Redis maxmemory-policy already noeviction');
    }
  } catch (err) {
    console.warn('⚠️  Unable to set Redis maxmemory-policy to noeviction:', err?.message || err);
  }
}

const startServer = async () => {
  const app = express();
  // Trust the first proxy hop (load balancer) so req.ip reflects the real
  // client address — required for correct per-client rate limiting behind an LB.
  app.set('trust proxy', 1);
  const server = createServer(app);

  const allowedOrigins = parseAllowedOrigins();

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis pubClient Error:', err));
  subClient.on('error', (err) => console.error('Redis subClient Error:', err));

  // Connect to Redis before starting the server
  await Promise.all([pubClient.connect(), subClient.connect()]);
  await ensureRedisNoEviction(pubClient);

  // Share the Redis client with the board-metadata cache (board:meta:* keys).
  initBoardCache(pubClient);

  // Distributed (Redis-backed) rate limiters — shared counters across instances.
  const { authLimiter, aiLimiter, apiLimiter } = createRateLimiters(pubClient);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );

  await connectToDatabase();

  app.use(express.json());

  // ─── Request logger ───────────────────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  app.use("/users", authLimiter, userRoute);
  app.use("/boards", apiLimiter, boardRoute);
  app.use("/ai", aiLimiter, aiRoutes);
  app.use("/publish", apiLimiter, publishRoute);
  app.use("/workspaces", apiLimiter, workspaceRoute);
  // ─── Yjs CRDT WebSocket server (co-exists on same HTTP server) ────────
  setupYjsWSServer(server, pubClient, subClient);
  console.log("✅ Yjs WebSocket server attached on /yjs path.");

  // ─── BullMQ persistence (write-behind to MongoDB every 30s) ───────────
  const bullRedisOpts = parseRedisUrl(process.env.REDIS_URL);
  const persistWorker = startPersistenceWorker(bullRedisOpts);
  const { stop: stopScheduler } = startPersistenceScheduler(bullRedisOpts);
  console.log("✅ BullMQ persistence worker & scheduler started.");

  // ─── BullMQ publish worker (board publish jobs) ────────────────────
  const publishQueue = initPublishQueue(bullRedisOpts);
  const publishWorker = startPublishWorker(bullRedisOpts);
  console.log("✅ BullMQ publish worker started.");

  // ─── Health & readiness probes (mounted after workers exist) ───────────
  app.use(
    createHealthRouter({
      redisClient: pubClient,
      getWorkers: () => [persistWorker, publishWorker],
    })
  );

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`🛑 Received ${signal}, shutting down...`);
    stopScheduler();
    await Promise.allSettled([
      persistWorker?.close(),
      publishWorker?.close(),
      publishQueue?.close(),
    ]);
    await Promise.allSettled([
      pubClient.quit(),
      subClient.quit(),
    ]);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => { shutdown('SIGTERM'); });
  process.on('SIGINT', () => { shutdown('SIGINT'); });
  process.on('SIGUSR2', () => { shutdown('SIGUSR2'); });

  server.listen(PORT, () => {
    // console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Server listening on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
});
