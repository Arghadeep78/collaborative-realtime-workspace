import "dotenv/config";
import express from "express";
import { createServer } from "http";

import { connectToDatabase } from "./config/db.js";
import { createRedisClients, parseRedisUrl } from "./config/redis.js";
import { createCorsMiddleware } from "./config/cors.js";
import { registerShutdownHandlers } from "./config/shutdown.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { createRateLimiters } from "./middleware/rate-limiters.middleware.js";
import { initProjectCache } from "./cache/project.cache.js";
import { setupYjsWSServer } from "./crdt/WSServer.js";
import { startPersistenceWorker } from "./crdt/persistenceWorker.js";
import { startPersistenceScheduler } from "./crdt/persistenceScheduler.js";
import { initPublishQueue } from "./jobs/publish.queue.js";
import { startPublishWorker } from "./jobs/publish.worker.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { documentManager } from "./crdt/DocumentManager.js";
import userRoute from "./routes/user.routes.js";
import projectRoute from "./routes/project.routes.js";
import publishRoute from "./routes/publish.routes.js";
import workspaceRoute from "./routes/workspace.routes.js";

export const buildApp = async () => {
  const app = express();
  const server = createServer(app);

  // Trust the first proxy hop (load balancer) so req.ip reflects the real
  // client address — required for correct per-client rate limiting behind an LB.
  app.set("trust proxy", 1);

  // ── Infrastructure ────────────────────────────────────────────────────────────
  await connectToDatabase();

  const { pubClient, subClient } = await createRedisClients();
  initProjectCache(pubClient);

  const bullRedisOpts = parseRedisUrl(process.env.REDIS_URL);
  const persistWorker = startPersistenceWorker(bullRedisOpts);
  const { queue: persistQueue, stop: stopScheduler } = startPersistenceScheduler(bullRedisOpts);
  console.log("✅ BullMQ persistence worker & scheduler started.");

  const publishQueue = initPublishQueue(bullRedisOpts);
  const publishWorker = startPublishWorker(bullRedisOpts);
  console.log("✅ BullMQ publish worker started.");

  setupYjsWSServer(server, pubClient, subClient);
  console.log("✅ Yjs WebSocket server attached on /yjs path.");

  // ── Global middleware ─────────────────────────────────────────────────────────
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(requestLogger);

  // ── Routes ────────────────────────────────────────────────────────────────────
  // Health probes before rate-limited routes so they are never throttled and
  // are always reachable by load balancers / orchestrators.
  app.use(createHealthRouter({ redisClient: pubClient, getWorkers: () => [persistWorker, publishWorker], persistQueue, documentManager }));

  const { authLimiter, apiLimiter } = createRateLimiters(pubClient);
  app.use("/users",      authLimiter, userRoute);
  app.use("/projects",   apiLimiter,  projectRoute);
  app.use("/publish",    apiLimiter,  publishRoute);
  app.use("/workspaces", apiLimiter,  workspaceRoute);

  // ── Shutdown ──────────────────────────────────────────────────────────────────
  registerShutdownHandlers({ server, pubClient, subClient, persistWorker, publishWorker, publishQueue, stopScheduler });

  return { app, server };
};
