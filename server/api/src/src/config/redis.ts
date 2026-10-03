import { env } from './env';
import { logger } from './logger';
import Redis from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

/**
 * Shared Redis / Valkey connection options.
 *
 * NOTE: BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`
 * on Redis connections to ensure blocking commands (like BRPOPLPUSH) behave properly.
 */
export const redisConnectionOptions: ConnectionOptions = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times: number) {
    // If Redis/Valkey is unreachable in local dev, cap reconnect attempts quickly
    if (times > 5) {
      return null; // Stop reconnecting after 5 attempts
    }
    const delay = Math.min(times * 500, 3000);
    return delay;
  },
};

/**
 * Test if Redis / Valkey server is currently reachable.
 * Times out quickly (1500ms) without spamming retries if down.
 */
export const checkRedisAvailability = async (): Promise<boolean> => {
  const client = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password || undefined,
    lazyConnect: true,
    connectTimeout: 1500,
    retryStrategy: () => null, // Do not retry for health check
    maxRetriesPerRequest: 1,
  });

  // Prevent Node from printing unhandled error events during health check
  client.on('error', () => {});

  try {
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    try {
      client.disconnect();
    } catch {}
    return false;
  }
};

/**
 * Create a standalone ioredis client instance using standard app options.
 */
export const createRedisClient = (): Redis => {
  const client = new Redis(redisConnectionOptions);

  client.on('error', (err) => {
    logger.error('Redis/Valkey client error:', err);
  });

  client.on('connect', () => {
    logger.info(`Connected to Redis/Valkey at ${env.redis.host}:${env.redis.port}`);
  });

  return client;
};
