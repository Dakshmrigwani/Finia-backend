import type { Server } from 'node:http';
import app from './app';
import { env } from './config';
import { logger } from './config/logger';
import prisma from './lib/prisma';

let server: Server;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    server = app.listen(env.port, () => {
      logger.info(`Listening on port ${env.port}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

void startServer();

const exitHandler = () => {
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
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
