import { parse } from 'csv-parse/sync';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';

export type AmountLayout =
  | { type: 'single'; amountIndex: number }
  | { type: 'separate'; debitIndex: number; creditIndex: number }
  | { type: 'typed'; amountIndex: number; typeIndex: number };

export interface DetectedColumns {
  dateIndex: number;
  descriptionIndex: number;
  layout: AmountLayout;
}

export interface RawParsedCsv {
  headers: string[];
  columns: DetectedColumns;
  rows: string[][]; // 0-based data rows
}

/**
 * Strip UTF-8 BOM if present
 */
export const stripBOM = (content: string): string => {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
};

/**
 * Detect column indices for Date, Description, and Amount layout.
 * Returns null if required columns cannot be detected.
 */
export const detectColumns = (rawHeaders: string[]): DetectedColumns | null => {
  const headers = rawHeaders.map((h) => stripBOM(h).trim().toLowerCase());

  // Date detection: date / txn date / transaction date / value date
  let dateIndex = -1;
  // Try exact/contained match with priority
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (
      h.includes('transaction date') ||
      h.includes('txn date') ||
      h.includes('value date') ||
      h.includes('date')
    ) {
      dateIndex = i;
      break;
    }
  }

  // Description detection: description / narration / details / particulars / remarks
  let descriptionIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (
      h.includes('description') ||
      h.includes('narration') ||
      h.includes('particulars') ||
      h.includes('details') ||
      h.includes('remarks')
    ) {
      descriptionIndex = i;
      break;
    }
  }

  if (dateIndex === -1 || descriptionIndex === -1) {
    return null;
  }

  // Amount layouts detection:
  // Layout b: separate debit / credit (or withdrawal / deposit)
  let debitIndex = -1;
  let creditIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h.includes('debit') || h.includes('withdrawal') || h.includes('dr')) {
      // make sure it's not "type" or "dr/cr"
      if (!h.includes('type') && !h.includes('/') && debitIndex === -1) {
        debitIndex = i;
      }
    }
    if (h.includes('credit') || h.includes('deposit') || h.includes('cr')) {
      if (!h.includes('type') && !h.includes('/') && creditIndex === -1) {
        creditIndex = i;
      }
    }
  }

  // Layout c: amount + type column with Dr/Cr or Debit/Credit
  let amountIndex = -1;
  let typeIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h.includes('amount')) {
      amountIndex = i;
    }
    if (
      h === 'type' ||
      h.includes('txn type') ||
      h.includes('transaction type') ||
      h.includes('dr/cr') ||
      h.includes('cr/dr')
    ) {
      typeIndex = i;
    }
  }

  let layout: AmountLayout | null = null;

  if (debitIndex !== -1 && creditIndex !== -1 && debitIndex !== creditIndex) {
    layout = { type: 'separate', debitIndex, creditIndex };
  } else if (amountIndex !== -1 && typeIndex !== -1 && amountIndex !== typeIndex) {
    layout = { type: 'typed', amountIndex, typeIndex };
  } else if (amountIndex !== -1) {
    layout = { type: 'single', amountIndex };
  }

  if (!layout) {
    return null;
  }

  return {
    dateIndex,
    descriptionIndex,
    layout,
  };
};

/**
 * Parse CSV buffer into rows and detect columns.
 * Enforces guardrails:
 * - max 5000 rows
 * - empty file, no header, or zero valid rows: 400
 * - columns not detected: 422 with detected headers
 */
export const parseCsv = (csvBuffer: Buffer): RawParsedCsv => {
  const content = stripBOM(csvBuffer.toString('utf-8')).trim();
  if (!content) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSV file is empty.');
  }

  let records: string[][];
  try {
    records = parse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid CSV format';
    throw new ApiError(httpStatus.BAD_REQUEST, `Failed to parse CSV: ${message}`);
  }

  if (!records || records.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSV file is empty or contains no records.');
  }

  // First non-empty row is header
  const rawHeaders = records[0].map((h) => stripBOM(h).trim());
  if (rawHeaders.every((h) => h === '')) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSV file has no valid header row.');
  }

  const dataRows = records.slice(1);
  if (dataRows.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSV file contains headers but zero data rows.');
  }

  if (dataRows.length > 5000) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSV file exceeds maximum limit of 5000 rows.');
  }

  const columns = detectColumns(rawHeaders);
  if (!columns) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'Could not detect required columns (Date, Description, Amount) from CSV headers.',
      false,
      undefined,
      { detectedHeaders: rawHeaders },
    );
  }

  return {
    headers: rawHeaders,
    columns,
    rows: dataRows,
  };
};
