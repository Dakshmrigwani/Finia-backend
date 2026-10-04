import { createHash } from 'node:crypto';
import type { NormalizedRow } from './normalize';

export interface FingerprintedRow extends NormalizedRow {
  importFingerprint: string;
  occurrenceIndex: number;
}

/**
 * Generate SHA-256 fingerprint according to Finia specs:
 * sha256 of: userId | YYYY-MM-DD | amount (2 decimals) | direction | lowercased whitespace-collapsed raw description | occurrenceIndex
 */
export const calculateFingerprint = (
  userId: string,
  dateStr: string,
  amount: number,
  direction: string,
  rawDescription: string,
  occurrenceIndex: number,
): string => {
  const normalizedDesc = rawDescription
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const amountStr = amount.toFixed(2);

  const payload = [
    userId,
    dateStr,
    amountStr,
    direction,
    normalizedDesc,
    occurrenceIndex.toString(),
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
};

/**
 * Assign occurrenceIndex and calculate fingerprints for a batch of normalized rows.
 *
 * occurrenceIndex = how many identical (same key without index) rows appeared EARLIER
 * in the same file (0, 1, 2...). This keeps two genuine identical purchases on one day
 * as two rows, while re-uploading the same file produces the same fingerprints.
 */
export const fingerprintRows = (
  userId: string,
  rows: NormalizedRow[],
): FingerprintedRow[] => {
  const occurrenceTracker = new Map<string, number>();

  return rows.map((row) => {
    const normalizedDesc = row.description
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const baseKey = `${row.dateStr}|${row.amount.toFixed(2)}|${row.direction}|${normalizedDesc}`;
    const occurrenceIndex = occurrenceTracker.get(baseKey) ?? 0;
    occurrenceTracker.set(baseKey, occurrenceIndex + 1);

    const importFingerprint = calculateFingerprint(
      userId,
      row.dateStr,
      row.amount,
      row.direction,
      row.description,
      occurrenceIndex,
    );

    return {
      ...row,
      importFingerprint,
      occurrenceIndex,
    };
  });
};
