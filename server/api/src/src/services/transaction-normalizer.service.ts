import type { TransactionDirection } from '@/types';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import type { RawParsedRow } from './transaction-parser.service';
import { categorizeTransaction } from './transaction-categorizer.service';

// ─── Internal DTO ─────────────────────────────────────────────────────────────

/**
 * Normalized transaction DTO — the single common shape used by all downstream
 * pipeline stages (deduplication, bulk insert, AI tools).
 *
 * This is what every import source (PDF, SMS, Bank API, Manual) produces.
 * The AI service works with this model, never with raw import data.
 */
export interface ParsedTransaction {
  date: Date;
  merchant: string;          // Cleaned, sanitized title
  amount: number;            // Positive decimal
  rawType: 'DEBIT' | 'CREDIT';
  direction: TransactionDirection;   // EXPENSE | INCOME | TRANSFER
  currency: string;          // ISO currency code e.g. "INR", "USD"
  source: 'PDF';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clean and sanitize a merchant / description string.
 * - Collapses multiple spaces
 * - Removes control characters
 * - Title-cases the result
 * - Truncates to 255 chars (Prisma column limit)
 */
const cleanMerchant = (raw: string): string => {
  return raw
    .replace(/[\x00-\x1F\x7F]/g, ' ') // strip control chars
    .replace(/\s+/g, ' ')              // collapse spaces
    .trim()
    .slice(0, 255);
};

/**
 * Map DEBIT/CREDIT to TransactionDirection.
 * SALARY and other income keywords on CREDIT rows → INCOME.
 * TRANSFER keywords → TRANSFER.
 * All other DEBITs → EXPENSE.
 */
const resolveDirection = (
  type: 'DEBIT' | 'CREDIT',
  merchant: string,
): TransactionDirection => {
  if (type === 'CREDIT') {
    if (/transfer|neft|rtgs|imps/i.test(merchant)) return 'TRANSFER';
    return 'INCOME';
  }
  if (/transfer|neft|rtgs|imps/i.test(merchant)) return 'TRANSFER';
  return 'EXPENSE';
};

/**
 * Extract ISO currency code from a user currency preference string.
 * e.g. "USD ($)" → "USD", "INR (₹)" → "INR", "INR" → "INR"
 * Falls back to "INR" for unrecognized formats (Indian bank statements default).
 */
export const extractCurrencyCode = (currencyPref: string | null | undefined): string => {
  if (!currencyPref) return 'INR';
  // Match leading ISO code: 2-4 uppercase letters
  const match = currencyPref.match(/^([A-Z]{2,4})/);
  return match ? match[1] : 'INR';
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NormalizeResult {
  normalized: ParsedTransaction[];
  failed: number;
}

/**
 * Normalize an array of RawParsedRows into ParsedTransaction DTOs.
 *
 * Each row is validated:
 *  - date must parse to a valid Date
 *  - amount must be > 0
 *  - description must be non-empty after cleaning
 *
 * Rows that fail validation are counted as `failed` (not silently dropped).
 *
 * @param rows   - Raw parsed rows from the bank statement parser
 * @param currency - User's currency preference string (e.g. "INR (₹)")
 */
export const normalizeTransactions = (
  rows: RawParsedRow[],
  currency?: string | null,
): NormalizeResult => {
  const currencyCode = extractCurrencyCode(currency);
  const normalized: ParsedTransaction[] = [];
  let failed = 0;

  for (const row of rows) {
    // Validate date
    const parsedDate = new Date(row.date);
    if (Number.isNaN(parsedDate.getTime())) {
      failed++;
      continue;
    }

    // Validate amount
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      failed++;
      continue;
    }

    // Clean merchant name
    const merchant = cleanMerchant(row.description);
    if (!merchant) {
      failed++;
      continue;
    }

    const direction = resolveDirection(row.type, merchant);

    normalized.push({
      date: parsedDate,
      merchant,
      amount: row.amount,
      rawType: row.type,
      direction,
      currency: currencyCode,
      source: 'PDF',
    });
  }

  return { normalized, failed };
};

/**
 * Merge a ParsedTransaction with categorization info, producing the final
 * ready-to-insert shape for the Prisma create call.
 */
export const toInsertShape = (
  userId: string,
  tx: ParsedTransaction & { category: string; type: string; importFingerprint: string },
) => ({
  userId,
  title: tx.merchant,
  amount: tx.amount,
  type: tx.type as never,
  direction: tx.direction,
  category: tx.category as never,
  recurrence: 'NONE' as const,
  date: tx.date,
  source: 'PDF' as const,
  importFingerprint: tx.importFingerprint,
});
