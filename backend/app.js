import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";

import { connectToDatabase } from "./config/db.js";
import { createRedisClients, parseRedisUrl } from "./config/redis.js";
import { createCorsMiddleware } from "./config/cors.js";
import { registerShutdownHandlers } from "./config/shutdown.js";
import { createRateLimiters } from "./middleware/rate-limiters.middleware.js";
import { initProjectCache } from "./cache/project.cache.js";
import { setupYjsWSServer } from "./crdt/WSServer.js";
import { startPersistenceWorker } from "./crdt/persistenceWorker.js";
import { startPersistenceScheduler } from "./crdt/persistenceScheduler.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { documentManager } from "./crdt/DocumentManager.js";
import { setWsTicketRedis } from "./controllers/user.controller.js";
import userRoute from "./routes/user.routes.js";
import projectRoute from "./routes/project.routes.js";
import publishRoute from "./routes/publish.routes.js";
import workspaceRoute from "./routes/workspace.routes.js";
import errorMiddleware from "./middleware/error.middleware.js";

const REQUIRED_ENV = [
  'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'DB_CLUSTER_URL',
  'REDIS_URL',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'EMAIL_USER', 'EMAIL_PASS',
  'FRONTEND_URL',
];

export const buildApp = async () => {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

  const app = express();
  const server = createServer(app);

  // Trust the first proxy hop (load balancer) so req.ip reflects the real
  // client address — required for correct per-client rate limiting behind an LB.
  app.set("trust proxy", 1);

  // ── Infrastructure ────────────────────────────────────────────────────────────
  await connectToDatabase();

  const { pubClient, subClient } = await createRedisClients();
  initProjectCache(pubClient);
  // Inject the Redis client into the WS-ticket controller so it can store
  // single-use tickets without importing Redis directly.
  setWsTicketRedis(pubClient);

  const bullRedisOpts = parseRedisUrl(process.env.REDIS_URL);
  const persistWorker = startPersistenceWorker(bullRedisOpts);
  const { queue: persistQueue, stop: stopScheduler } = startPersistenceScheduler(bullRedisOpts);
  console.log("✅ BullMQ persistence worker & scheduler started.");

  setupYjsWSServer(server, pubClient, subClient);
  console.log("✅ Yjs WebSocket server attached on /yjs path.");

  // ── Global middleware ─────────────────────────────────────────────────────────
  app.use(createCorsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ── Routes ────────────────────────────────────────────────────────────────────
  // Health probes before rate-limited routes so they are never throttled and
  // are always reachable by load balancers / orchestrators.
  app.use(createHealthRouter({ redisClient: pubClient, getWorkers: () => [persistWorker], persistQueue, documentManager }));

  const { authLimiter, apiLimiter } = createRateLimiters(pubClient);
  app.use("/users",      authLimiter, userRoute);
  app.use("/projects",   apiLimiter,  projectRoute);
  app.use("/publish",    apiLimiter,  publishRoute);
  app.use("/workspaces", apiLimiter,  workspaceRoute);

  // ── Error handling ────────────────────────────────────────────────────────────
  // Must be registered after all routes so it catches errors forwarded via next(err).
  app.use(errorMiddleware);

  // ── Shutdown ──────────────────────────────────────────────────────────────────
  registerShutdownHandlers({ server, pubClient, subClient, persistWorker, stopScheduler });

  return { app, server };
};
