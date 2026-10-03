import { Queue, type Job } from 'bullmq';
import { redisConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import type { ImportSummary } from '@/services/transaction-import.service';

export const TRANSACTION_QUEUE_NAME = 'transaction-processing';
export const JOB_PROCESS_PDF_IMPORT = 'process-pdf-import' as const;

export interface ProcessPdfImportJobData {
  userId: string;
  fileBufferBase64: string;
  currency?: string | null;
  originalFileName?: string;
}

export type TransactionJobProgress = {
  percent: number;
  step: string;
};

let queueInstance: Queue<
  ProcessPdfImportJobData,
  ImportSummary,
  typeof JOB_PROCESS_PDF_IMPORT
> | null = null;

let isQueueActive = false;

/**
 * Update whether background queue is enabled (based on Redis/Valkey connectivity).
 */
export const setQueueActive = (active: boolean) => {
  isQueueActive = active;
};

/**
 * Check if the background queue is available.
 */
export const isQueueEnabled = () => isQueueActive;

/**
 * Lazy accessor for the BullMQ Queue instance.
 * Avoids creating Redis connections when Redis/Valkey is offline.
 */
export const getTransactionQueue = (): Queue<
  ProcessPdfImportJobData,
  ImportSummary,
  typeof JOB_PROCESS_PDF_IMPORT
> => {
  if (!queueInstance) {
    queueInstance = new Queue<
      ProcessPdfImportJobData,
      ImportSummary,
      typeof JOB_PROCESS_PDF_IMPORT
    >(
      TRANSACTION_QUEUE_NAME,
      {
        connection: redisConnectionOptions,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 86400, // Retain completed jobs for 24h
            count: 1000,
          },
          removeOnFail: {
            age: 604800, // Retain failed jobs for 7 days
            count: 5000,
          },
        },
      },
    );

    queueInstance.on('error', (err) => {
      logger.error(`BullMQ [${TRANSACTION_QUEUE_NAME}] error:`, err);
    });
  }

  return queueInstance;
};

/**
 * Enqueue a PDF bank statement import job.
 */
export const enqueuePdfImport = async (
  userId: string,
  buffer: Buffer,
  currency?: string | null,
  originalFileName?: string,
): Promise<Job<ProcessPdfImportJobData, ImportSummary, typeof JOB_PROCESS_PDF_IMPORT>> => {
  const queue = getTransactionQueue();

  const job = await queue.add(
    JOB_PROCESS_PDF_IMPORT,
    {
      userId,
      fileBufferBase64: buffer.toString('base64'),
      currency,
      originalFileName,
    },
    {
      jobId: `pdf-import-${userId}-${Date.now()}`,
    },
  );

  logger.info(
    'Enqueued PDF import job %s for user %s (file: %s)',
    job.id,
    userId,
    originalFileName ?? 'unknown',
  );

  return job;
};

/**
 * Retrieve status, progress, and result of an import job.
 * Enforces tenant security (user can only inspect their own jobs).
 */
export const getImportJobStatus = async (jobId: string, userId: string) => {
  if (!isQueueEnabled()) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Background queue service is currently offline (Redis/Valkey unavailable).',
    );
  }

  const queue = getTransactionQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Import job not found.');
  }

  // Security check: verify this job belongs to the authenticated user
  if (job.data?.userId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'You do not have permission to view this import job.',
    );
  }

  const state = await job.getState();

  return {
    jobId: job.id,
    state,
    progress: (job.progress as TransactionJobProgress | undefined) ?? { percent: 0, step: 'Queued' },
    result: job.returnvalue ?? null,
    failedReason: job.failedReason ?? null,
    attemptsMade: job.attemptsMade,
    createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
  };
};

/**
 * Graceful close for queue connections.
 */
export const closeTransactionQueue = async (): Promise<void> => {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
    isQueueActive = false;
    logger.info(`BullMQ queue [${TRANSACTION_QUEUE_NAME}] closed.`);
  }
};
