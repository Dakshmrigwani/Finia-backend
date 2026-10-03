import { startTransactionWorker, closeTransactionWorker } from './transaction.worker';
import { closeTransactionQueue, setQueueActive } from '@/queues/transaction.queue';
import { checkRedisAvailability } from '@/config/redis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * Initialize all application background workers.
 * If Redis / Valkey is not reachable, gracefully disables queue workers
 * and switches to synchronous fallback mode without spamming connection errors.
 */
export const initWorkers = async () => {
  const isAvailable = await checkRedisAvailability();

  if (!isAvailable) {
    setQueueActive(false);
    logger.warn(
      `[BullMQ] Redis/Valkey is not reachable at ${env.redis.host}:${env.redis.port}. Background workers disabled. Running in synchronous fallback mode. (Start Docker/Valkey to enable background queue processing).`,
    );
    return;
  }

  try {
    setQueueActive(true);
    startTransactionWorker();
    logger.info('All background workers initialized successfully.');
  } catch (error) {
    setQueueActive(false);
    logger.error('Failed to initialize background workers:', error);
  }
};

/**
 * Gracefully stop all background workers and queues.
 */
export const shutdownWorkers = async () => {
  logger.info('Shutting down background workers and queues...');
  await Promise.allSettled([
    closeTransactionWorker(),
    closeTransactionQueue(),
  ]);
  logger.info('Background workers and queues shutdown completed.');
};

export {
  startTransactionWorker,
  closeTransactionWorker,
};
