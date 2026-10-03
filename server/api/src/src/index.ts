import type { Server } from 'node:http';
import app from './app';
import { env } from './config';
import { logger } from './config/logger';
import prisma from './lib/prisma';
import { initWorkers, shutdownWorkers } from './workers';

let server: Server;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    // Initialize BullMQ background workers (probes Redis/Valkey connectivity)
    await initWorkers();

    server = app.listen(env.port, '0.0.0.0', () => {
      logger.info(`Listening on port ${env.port} on all interfaces`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

void startServer();

const exitHandler = async () => {
  try {
    await shutdownWorkers();
  } catch (err) {
    logger.error('Error during worker shutdown:', err);
  }

  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: unknown) => {
  logger.error(error);
  void exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received`);
  try {
    await shutdownWorkers();
  } catch (err) {
    logger.error('Error during worker shutdown:', err);
  }

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
