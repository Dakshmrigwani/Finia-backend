import type { DetectedColumns } from './csvParser';
import type {
  TransactionDirection,
  TransactionType,
  TransactionCategory,
  TransactionSource,
} from '@/types';

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export interface NormalizedRow {
  rowNumber: number; // 1-based line number (header is 1, first data row is 2)
  date: Date;
  dateStr: string; // YYYY-MM-DD
  title: string;
  description: string;
  amount: number; // Positive Decimal number
  direction: TransactionDirection;
  type: TransactionType;
  category: TransactionCategory;
  source: TransactionSource;
}

export interface FailedRow {
  row: number;
  reason: string;
}

export interface NormalizeOptions {
  dateFormat?: DateFormat;
}

export interface NormalizeOutput {
  normalized: NormalizedRow[];
  failed: FailedRow[];
  warnings: string[];
}

/**
 * Clean title: trimmed, whitespace-collapsed description
 */
export const cleanTitle = (raw: string): string => {
  return raw
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
};

/**
 * Clean description: raw description exactly as in the file, but truncated to 10000 if needed
 */
export const cleanDescription = (raw: string): string => {
  return raw;
};

/**
 * Parse an amount string according to bank statement rules:
 * - strip currency symbols (₹, $, €, £, etc.)
 * - strip thousands separators (commas)
 * - strip spaces
 * - handles accounting parentheses e.g. "(1,200.00)" = negative
 * - returns { value: number, isNegative: boolean } or null if invalid/zero
 */
export const parseAmountString = (
  raw: string,
): { value: number; isNegative: boolean } | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let isNegative = false;
  let clean = trimmed;

  // Check for accounting parentheses: (1,200.00) or ( 1,200.00 )
  if (/^\(.*\)$/.test(clean)) {
    isNegative = true;
    clean = clean.slice(1, -1).trim();
  } else if (clean.startsWith('-') || clean.endsWith('-')) {
    isNegative = true;
    clean = clean.replace(/-/g, '').trim();
  } else if (clean.startsWith('+')) {
    clean = clean.slice(1).trim();
  }

  // Remove common currency symbols and anything that isn't a digit, period, or comma
  // Specific symbols: ₹, $, €, £, ¥, Rs, INR, USD, etc.
  clean = clean.replace(/[^\d.,]/g, '');

  // Handle commas as thousands separators (e.g., 1,200.50 or 1,200)
  // If format is 1,200.50 -> remove commas
  // If format is 1.200,50 (European) vs 1,200.50 (Indian/US):
  // Let's standardise: if there's both comma and dot, comma is thousand separator if dot is decimal
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/,/g, '');
  } else if (clean.includes(',')) {
    // If only commas: check if it's 1,200 or 12,50
    // If it has multiple commas or 3 digits after comma, it's thousands separator: 1,200 or 1,200,000
    const parts = clean.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      clean = clean.replace(/,/g, '');
    } else {
      // European decimal comma e.g. 12,50 -> 12.50
      clean = clean.replace(',', '.');
    }
  }

  const num = Number.parseFloat(clean);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }

  // Round to 2 decimals
  const rounded = Math.round(num * 100) / 100;
  if (rounded === 0) {
    return null;
  }

  return {
    value: rounded,
    isNegative,
  };
};

/**
 * Determine date format automatically by scanning date strings if dateFormat is not provided:
 * - If any value has first part > 12 -> DD/MM
 * - If any value has second part > 12 -> MM/DD
 * - If still ambiguous -> default to DD/MM/YYYY and add a warning
 */
export const detectDateFormatFromSamples = (
  dateStrings: string[],
): { format: DateFormat; ambiguous: boolean } => {
  let hasFirstPartOver12 = false;
  let hasSecondPartOver12 = false;

  for (const str of dateStrings) {
    const trimmed = str.trim();
    // Match YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed)) {
      return { format: 'YYYY-MM-DD', ambiguous: false };
    }

    // Match 2-part / 3-part date: D/M/Y or M/D/Y
    const match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (match) {
      const p1 = Number.parseInt(match[1], 10);
      const p2 = Number.parseInt(match[2], 10);
      if (p1 > 12) {
        hasFirstPartOver12 = true;
      }
      if (p2 > 12) {
        hasSecondPartOver12 = true;
      }
    }
  }

  if (hasFirstPartOver12 && !hasSecondPartOver12) {
    return { format: 'DD/MM/YYYY', ambiguous: false };
  }
  if (hasSecondPartOver12 && !hasFirstPartOver12) {
    return { format: 'MM/DD/YYYY', ambiguous: false };
  }

  // Still ambiguous: default to DD/MM/YYYY with warning
  return { format: 'DD/MM/YYYY', ambiguous: true };
};

/**
 * Parse a date string into a Date at 00:00:00.000 UTC of that calendar day.
 * Returns null if invalid.
 */
export const parseDateToUtc = (
  rawDate: string,
  format: DateFormat,
): { date: Date; dateStr: string } | null => {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  let year: number;
  let month: number; // 1-12
  let day: number;

  if (format === 'YYYY-MM-DD') {
    const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (!match) return null;
    year = Number.parseInt(match[1], 10);
    month = Number.parseInt(match[2], 10);
    day = Number.parseInt(match[3], 10);
  } else {
    const match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (!match) return null;
    let p1 = Number.parseInt(match[1], 10);
    let p2 = Number.parseInt(match[2], 10);
    let p3 = Number.parseInt(match[3], 10);

    if (p3 < 100) {
      // 2-digit year
      p3 += p3 < 50 ? 2000 : 1900;
    }

    year = p3;
    if (format === 'DD/MM/YYYY') {
      day = p1;
      month = p2;
    } else {
      // MM/DD/YYYY
      month = p1;
      day = p2;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }

  // Verify days in month
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateStr = `${year}-${mm}-${dd}`;

  return { date: utcDate, dateStr };
};

/**
 * Check if an entire CSV row is completely empty/blank
 */
export const isBlankRow = (row: string[]): boolean => {
  return row.every((cell) => !cell || cell.trim() === '');
};

/**
 * Normalize CSV rows into NormalizedRow records.
 * Follows Finia rules:
 * - Skip fully blank rows silently
 * - Record bad rows in `failed` with row number (1-based, where row 1 = header)
 * - Direction: debit / negative = EXPENSE (OUT), credit / positive = INCOME (IN)
 * - Type: EXPENSE -> VARIABLE, INCOME -> FIXED (or matching direction)
 * - Category: 'OTHER'
 * - Source: 'CSV'
 */
export const normalizeRows = (
  rawRows: string[][],
  columns: DetectedColumns,
  options: NormalizeOptions = {},
): NormalizeOutput => {
  const warnings: string[] = [];
  const normalized: NormalizedRow[] = [];
  const failed: FailedRow[] = [];

  // Determine date format
  let effectiveDateFormat = options.dateFormat;
  if (!effectiveDateFormat) {
    const sampleDates = rawRows
      .filter((r) => !isBlankRow(r) && r[columns.dateIndex])
      .map((r) => r[columns.dateIndex]);

    const detected = detectDateFormatFromSamples(sampleDates);
    effectiveDateFormat = detected.format;
    if (detected.ambiguous) {
      warnings.push(
        'Date format was ambiguous (day and month could not be uniquely inferred). Defaulted to DD/MM/YYYY.',
      );
    }
  }

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 2; // header is row 1, data starts at row 2

    if (isBlankRow(row)) {
      // Skip fully blank rows silently
      continue;
    }

    const rawDate = row[columns.dateIndex] || '';
    const rawDesc = row[columns.descriptionIndex] || '';

    // Validate description
    const title = cleanTitle(rawDesc);
    if (!title) {
      failed.push({ row: rowNumber, reason: 'Description is missing or empty' });
      continue;
    }

    // Validate and parse date
    const parsedDate = parseDateToUtc(rawDate, effectiveDateFormat);
    if (!parsedDate) {
      failed.push({
        row: rowNumber,
        reason: `Invalid or unparseable date '${rawDate}' with format ${effectiveDateFormat}`,
      });
      continue;
    }

    // Validate and parse amount & direction based on layout
    let amount: number;
    let direction: TransactionDirection;

    if (columns.layout.type === 'single') {
      const rawAmt = row[columns.layout.amountIndex] || '';
      const parsedAmt = parseAmountString(rawAmt);
      if (!parsedAmt) {
        failed.push({ row: rowNumber, reason: `Invalid or zero amount '${rawAmt}'` });
        continue;
      }
      amount = parsedAmt.value;
      // negative = money out (EXPENSE), positive = money in (INCOME)
      direction = parsedAmt.isNegative ? 'EXPENSE' : 'INCOME';
    } else if (columns.layout.type === 'separate') {
      const rawDebit = row[columns.layout.debitIndex] || '';
      const rawCredit = row[columns.layout.creditIndex] || '';

      const parsedDebit = parseAmountString(rawDebit);
      const parsedCredit = parseAmountString(rawCredit);

      if (parsedDebit && parsedCredit) {
        failed.push({
          row: rowNumber,
          reason: 'Both debit and credit amounts are present on the same row',
        });
        continue;
      }
      if (!parsedDebit && !parsedCredit) {
        failed.push({
          row: rowNumber,
          reason: `No valid debit or credit amount found in row (debit: '${rawDebit}', credit: '${rawCredit}')`,
        });
        continue;
      }

      if (parsedDebit) {
        amount = parsedDebit.value;
        direction = 'EXPENSE';
      } else {
        amount = parsedCredit!.value;
        direction = 'INCOME';
      }
    } else {
      // typed layout: amount + type column
      const rawAmt = row[columns.layout.amountIndex] || '';
      const rawType = (row[columns.layout.typeIndex] || '').trim().toLowerCase();

      const parsedAmt = parseAmountString(rawAmt);
      if (!parsedAmt) {
        failed.push({ row: rowNumber, reason: `Invalid or zero amount '${rawAmt}'` });
        continue;
      }

      amount = parsedAmt.value;

      if (
        rawType === 'dr' ||
        rawType === 'debit' ||
        rawType.startsWith('dr') ||
        rawType.startsWith('deb')
      ) {
        direction = 'EXPENSE';
      } else if (
        rawType === 'cr' ||
        rawType === 'credit' ||
        rawType.startsWith('cr') ||
        rawType.startsWith('cre')
      ) {
        direction = 'INCOME';
      } else {
        // If type is not explicitly recognized, fallback to sign of parsed amount
        direction = parsedAmt.isNegative ? 'EXPENSE' : 'INCOME';
      }
    }

    // Map type: expense -> VARIABLE, income -> FIXED (per Finia existing convention)
    const type: TransactionType = direction === 'INCOME' ? 'FIXED' : 'VARIABLE';
    const category: TransactionCategory = 'OTHER';
    const source: TransactionSource = 'CSV';

    normalized.push({
      rowNumber,
      date: parsedDate.date,
      dateStr: parsedDate.dateStr,
      title,
      description: cleanDescription(rawDesc),
      amount,
      direction,
      type,
      category,
      source,
    });
  }

  return {
    normalized,
    failed,
    warnings,
  };
};
