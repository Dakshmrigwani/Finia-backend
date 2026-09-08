import { logger } from '@/config/logger';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import prisma from '@/lib/prisma';
import { extractTextFromPdf } from './pdf-parser.service';
import { parseTransactionsFromText } from './transaction-parser.service';
import { normalizeTransactions, toInsertShape } from './transaction-normalizer.service';
import { categorizeTransaction } from './transaction-categorizer.service';
import { deduplicateTransactions } from './transaction-deduplication.service';

// ─── Import Summary ───────────────────────────────────────────────────────────

export interface ImportSummary {
  success: boolean;
  totalExtracted: number;
  inserted: number;
  duplicates: number;
  failed: number;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Full PDF → PostgreSQL import pipeline.
 *
 * Steps:
 *  1. Extract text from PDF buffer
 *  2. Parse rows from text (bank-agnostic generic parser)
 *  3. Normalize rows into ParsedTransaction DTOs
 *  4. Categorize each transaction (rule-based)
 *  5. Deduplicate against existing DB records (by fingerprint)
 *  6. Bulk-insert new transactions (atomic DB transaction)
 *  7. Return ImportSummary
 *
 * This function never logs any financial content (amounts, merchants, etc).
 * The AI service does NOT call this — it queries already-stored transactions.
 *
 * @param userId   - Authenticated user ID from JWT (never from request body)
 * @param buffer   - PDF file buffer from multer memory storage
 * @param currency - User's currency preference string (e.g. "INR (₹)")
 */
export const importTransactionsFromPdf = async (
  userId: string,
  buffer: Buffer,
  currency?: string | null,
): Promise<ImportSummary> => {
  // ── Step 1: Extract text ─────────────────────────────────────────
  const text = await extractTextFromPdf(buffer);

  // ── Step 2: Parse rows ───────────────────────────────────────────
  const { parsed, failed: parseFailed } = parseTransactionsFromText(text);

  if (parsed.length === 0) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'No transactions could be detected in the PDF. ' +
      'Please ensure this is a text-based bank statement (not a scanned image).',
    );
  }

  logger.info('PDF import: %d rows parsed from PDF', parsed.length);

  // ── Step 3: Normalize ────────────────────────────────────────────
  const { normalized, failed: normFailed } = normalizeTransactions(parsed, currency);

  const totalFailed = parseFailed + normFailed;
  logger.info(
    'PDF import: %d normalized, %d total failed rows',
    normalized.length,
    totalFailed,
  );

  if (normalized.length === 0) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      `${totalFailed} rows were detected but none could be normalized into valid transactions.`,
    );
  }

  // ── Step 4: Categorize ────────────────────────────────────────────
  const categorized = normalized.map((tx) => {
    const { category, type } = categorizeTransaction(tx.merchant);
    return { ...tx, category, type };
  });

  // ── Step 5: Deduplicate ───────────────────────────────────────────
  const { toInsert, duplicateCount } = await deduplicateTransactions(userId, categorized);

  logger.info(
    'PDF import: %d new, %d duplicates (skipped)',
    toInsert.length,
    duplicateCount,
  );

  let inserted = 0;

  // ── Step 6: Bulk insert ───────────────────────────────────────────
  if (toInsert.length > 0) {
    const insertData = toInsert.map((tx) =>
      toInsertShape(userId, tx),
    );

    // Use a Prisma transaction so the entire batch is atomic
    await prisma.$transaction(async (tx) => {
      const result = await tx.transaction.createMany({
        data: insertData,
        skipDuplicates: true, // Extra safety net at DB level
      });
      inserted = result.count;
    });

    logger.info('PDF import: %d transactions inserted', inserted);
  }

  // ── Step 7: Return summary ────────────────────────────────────────
  return {
    success: true,
    totalExtracted: parsed.length,
    inserted,
    duplicates: duplicateCount,
    failed: totalFailed,
  };
};
