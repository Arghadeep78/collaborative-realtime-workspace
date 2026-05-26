import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

/**
 * Rate limiters backed by a SHARED Redis store.
 *
 * In-memory counters break the moment you scale past one Node process: each
 * instance keeps its own count, so N instances effectively multiply every
 * limit by N. Routing the counters through Redis keeps a single global limit
 * across the whole fleet behind the load balancer.
 *
 * @param {import('redis').RedisClientType} redisClient
 */
export function createRateLimiters(redisClient) {
  const store = (prefix) =>
    new RedisStore({
      prefix,
      // node-redis v4/v5: sendCommand takes a flat array of args.
      sendCommand: (...args) => redisClient.sendCommand(args),
    });

  const base = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    standardHeaders: true, // emit RateLimit-* headers
    legacyHeaders: false,
  };

  // Auth endpoints: brute-force surface (login / register) — keep tight.
  const authLimiter = rateLimit({
    ...base,
    max: 50,
    message: { error: 'Too many authentication attempts, please try again later.' },
    store: store('rl:auth:'),
  });

  // AI feature disabled — aiLimiter removed
  // const aiLimiter = rateLimit({
  //   ...base,
  //   max: 40,
  //   message: { error: 'AI request limit reached, please slow down.' },
  //   store: store('rl:ai:'),
  // });

  // General REST API (boards, publishing): generous but bounded.
  const apiLimiter = rateLimit({
    ...base,
    max: 300,
    message: { error: 'Too many requests, please try again later.' },
    store: store('rl:api:'),
  });

  return { authLimiter, apiLimiter };
}
