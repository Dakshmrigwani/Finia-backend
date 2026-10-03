import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import {
  TRANSACTION_QUEUE_NAME,
  JOB_PROCESS_PDF_IMPORT,
  type ProcessPdfImportJobData,
} from '@/queues/transaction.queue';
import {
  importTransactionsFromPdf,
  type ImportSummary,
} from '@/services/transaction-import.service';

let transactionWorker: Worker<
  ProcessPdfImportJobData,
  ImportSummary,
  typeof JOB_PROCESS_PDF_IMPORT
> | null = null;

/**
 * Worker processor function for transaction queue jobs.
 */
export const processTransactionJob = async (
  job: Job<ProcessPdfImportJobData, ImportSummary, typeof JOB_PROCESS_PDF_IMPORT>,
): Promise<ImportSummary> => {
  logger.info(
    'BullMQ worker processing job %s (attempt %d/%d) for user %s',
    job.id,
    job.attemptsMade + 1,
    job.opts.attempts ?? 1,
    job.data.userId,
  );

  switch (job.name) {
    case JOB_PROCESS_PDF_IMPORT: {
      const { userId, fileBufferBase64, currency } = job.data;
      const buffer = Buffer.from(fileBufferBase64, 'base64');

      const summary = await importTransactionsFromPdf(
        userId,
        buffer,
        currency,
        async (progress) => {
          await job.updateProgress(progress);
        },
      );

      logger.info(
        'BullMQ worker completed job %s: extracted=%d, inserted=%d, duplicates=%d',
        job.id,
        summary.totalExtracted,
        summary.inserted,
        summary.duplicates,
      );

      return summary;
    }

    default:
      throw new Error(`Unknown job name: ${(job as any).name}`);
  }
};

/**
 * Initialize and start the transaction BullMQ worker.
 *
 * @param concurrency - Number of concurrent jobs this worker processes (default: 5)
 */
export const startTransactionWorker = (
  concurrency = 5,
): Worker<ProcessPdfImportJobData, ImportSummary, typeof JOB_PROCESS_PDF_IMPORT> => {
  if (transactionWorker) {
    return transactionWorker;
  }

  transactionWorker = new Worker<
    ProcessPdfImportJobData,
    ImportSummary,
    typeof JOB_PROCESS_PDF_IMPORT
  >(
    TRANSACTION_QUEUE_NAME,
    processTransactionJob,
    {
      connection: redisConnectionOptions,
      concurrency,
      limiter: {
        max: 20,
        duration: 1000, // Rate limit: max 20 jobs/second across workers
      },
    },
  );

  transactionWorker.on('completed', (job: Job) => {
    logger.info('BullMQ worker: Job %s completed successfully', job.id);
  });

  transactionWorker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error('BullMQ worker: Job %s failed with error: %s', job?.id, err.message, {
      stack: err.stack,
    });
  });

  transactionWorker.on('error', (err: Error) => {
    logger.error('BullMQ transaction worker internal error:', err);
  });

  transactionWorker.on('stalled', (jobId: string) => {
    logger.warn('BullMQ transaction worker: Job %s stalled and will be reprocessed', jobId);
  });

  logger.info(`BullMQ transaction worker started (concurrency: ${concurrency})`);
  return transactionWorker;
};

/**
 * Graceful shutdown for the transaction worker.
 */
export const closeTransactionWorker = async (): Promise<void> => {
  if (transactionWorker) {
    logger.info('Closing BullMQ transaction worker...');
    await transactionWorker.close();
    transactionWorker = null;
    logger.info('BullMQ transaction worker closed.');
  }
};
