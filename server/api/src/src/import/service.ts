import prisma from '@/lib/prisma';
import { parseCsv } from './csvParser';
import { normalizeRows, type DateFormat, type FailedRow } from './normalize';
import { fingerprintRows, type FingerprintedRow } from './fingerprint';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import { Prisma } from '@/generated/prisma/client';

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: FailedRow[];
  warnings: string[];
  dateRange: { from: string; to: string } | null;
}

/**
 * Service to process CSV bank-statement import end-to-end:
 * 1. Parse CSV with guardrails
 * 2. Normalize rows (dates, positive amounts, directions, types, clean titles)
 * 3. Fingerprint with occurrenceIndex
 * 4. Deduplicate using findMany in DB
 * 5. Batch insert non-duplicates, catching race-condition unique violations safely
 * 6. Return standard Finia response summary
 */
export const importCsvStatement = async (
  userId: string,
  csvBuffer: Buffer,
  dateFormat?: DateFormat,
): Promise<ImportResult> => {
  // 1. Parse CSV
  const { columns, rows } = parseCsv(csvBuffer);

  // 2. Normalize rows
  const { normalized, failed, warnings } = normalizeRows(rows, columns, { dateFormat });

  if (normalized.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      failed.length > 0
        ? `CSV contains zero valid rows. ${failed.length} rows failed validation.`
        : 'CSV file contains zero valid transaction rows.',
    );
  }

  // Calculate dateRange from all valid normalized rows
  let minDateStr = normalized[0].dateStr;
  let maxDateStr = normalized[0].dateStr;
  for (const r of normalized) {
    if (r.dateStr < minDateStr) minDateStr = r.dateStr;
    if (r.dateStr > maxDateStr) maxDateStr = r.dateStr;
  }
  const dateRange = { from: minDateStr, to: maxDateStr };

  // 3. Fingerprint rows
  const fingerprinted = fingerprintRows(userId, normalized);
  const fingerprints = fingerprinted.map((r) => r.importFingerprint);

  // 4. Find existing fingerprints in DB (scoped by userId)
  const existingRecords = await prisma.transaction.findMany({
    where: {
      userId,
      importFingerprint: { in: fingerprints },
    },
    select: { importFingerprint: true },
  });

  const existingSet = new Set(
    existingRecords.map((r) => r.importFingerprint).filter(Boolean) as string[],
  );

  const toInsert = fingerprinted.filter((r) => !existingSet.has(r.importFingerprint));
  const preSkippedCount = fingerprinted.length - toInsert.length;

  let actuallyInserted = 0;
  let raceDuplicates = 0;

  // 5. Insert in batches (e.g. 500)
  const BATCH_SIZE = 500;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const insertPayload = batch.map((r) => ({
      userId,
      title: r.title,
      description: r.description,
      amount: r.amount,
      type: r.type,
      direction: r.direction,
      category: r.category,
      recurrence: 'NONE' as const,
      date: r.date,
      source: r.source,
      importFingerprint: r.importFingerprint,
    }));

    try {
      const result = await prisma.transaction.createMany({
        data: insertPayload,
      });
      actuallyInserted += result.count;
    } catch (err: unknown) {
      // If there's a unique constraint violation from a concurrent race,
      // fallback to row-by-row insertion to safely skip the duplicate
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        for (const singleItem of insertPayload) {
          try {
            await prisma.transaction.create({
              data: singleItem,
            });
            actuallyInserted++;
          } catch (rowErr: unknown) {
            if (
              rowErr instanceof Prisma.PrismaClientKnownRequestError &&
              rowErr.code === 'P2002'
            ) {
              raceDuplicates++;
            } else {
              throw rowErr;
            }
          }
        }
      } else {
        throw err;
      }
    }
  }

  return {
    imported: actuallyInserted,
    skipped: preSkippedCount + raceDuplicates,
    failed,
    warnings,
    dateRange,
  };
};

export default {
  importCsvStatement,
};
