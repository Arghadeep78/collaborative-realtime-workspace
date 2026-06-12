import { createClient } from 'redis';

export function parseRedisUrl(url) {
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

export async function createRedisClients() {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis pubClient Error:', err));
  subClient.on('error', (err) => console.error('Redis subClient Error:', err));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  await ensureRedisNoEviction(pubClient);

  return { pubClient, subClient };
}
