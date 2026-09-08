import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import type { ParsedTransaction } from './transaction-normalizer.service';

// ─── Fingerprint Generation ───────────────────────────────────────────────────

/**
 * Generate a deterministic SHA-256 fingerprint for a transaction.
 *
 * The fingerprint is derived from fields that uniquely identify a transaction:
 *   userId + date(YYYY-MM-DD) + merchant(lowercase) + amount(2dp) + rawType
 *
 * This makes the import idempotent: uploading the same PDF twice will
 * produce identical fingerprints, and duplicates will be skipped.
 *
 * @returns Hex-encoded SHA-256 string (64 chars)
 */
export const generateFingerprint = (
  userId: string,
  tx: Pick<ParsedTransaction, 'date' | 'merchant' | 'amount' | 'rawType'>,
): string => {
  const datePart = tx.date.toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = [
    userId,
    datePart,
    tx.merchant.toLowerCase().trim(),
    tx.amount.toFixed(2),
    tx.rawType,
  ].join('|');

  return createHash('sha256').update(raw).digest('hex');
};

// ─── Deduplication ────────────────────────────────────────────────────────────

export interface WithFingerprint extends ParsedTransaction {
  importFingerprint: string;
  category: string;
  type: string;
}

export interface DeduplicateResult {
  toInsert: WithFingerprint[];
  duplicateCount: number;
}

/**
 * Deduplicate a batch of normalized transactions against the database.
 *
 * Process:
 *  1. Generate fingerprints for all incoming transactions
 *  2. Batch-query the DB for existing fingerprints (single query)
 *  3. Return only transactions whose fingerprints don't already exist
 *
 * This makes the bulk import operation idempotent — safe to re-upload the
 * same PDF multiple times without creating duplicate records.
 *
 * @param userId       - Authenticated user ID
 * @param transactions - Normalized + categorized transactions
 */
export const deduplicateTransactions = async (
  userId: string,
  transactions: Array<ParsedTransaction & { category: string; type: string }>,
): Promise<DeduplicateResult> => {
  if (transactions.length === 0) {
    return { toInsert: [], duplicateCount: 0 };
  }

  // Step 1: Generate fingerprints for all incoming transactions
  const withFingerprints: WithFingerprint[] = transactions.map((tx) => ({
    ...tx,
    importFingerprint: generateFingerprint(userId, tx),
  }));

  const incomingFingerprints = withFingerprints.map((t) => t.importFingerprint);

  // Step 2: Single DB query to find which fingerprints already exist
  const existing = await prisma.transaction.findMany({
    where: {
      userId,
      importFingerprint: { in: incomingFingerprints },
    },
    select: { importFingerprint: true },
  });

  const existingSet = new Set(
    existing.map((e) => e.importFingerprint).filter(Boolean) as string[],
  );

  // Step 3: Split into new vs duplicates
  const toInsert = withFingerprints.filter(
    (t) => !existingSet.has(t.importFingerprint),
  );

  return {
    toInsert,
    duplicateCount: withFingerprints.length - toInsert.length,
  };
};
