import { logger } from '@/config/logger';

// ─── Raw Row DTO ──────────────────────────────────────────────────────────────

/**
 * A single row as extracted from a bank statement PDF, before normalization.
 * Bank-format-specific parsers all produce this common shape.
 */
export interface RawParsedRow {
  date: string;        // Raw date string from the PDF as-is (ISO YYYY-MM-DD)
  description: string; // Merchant / transaction description
  amount: number;      // Absolute positive number
  type: 'DEBIT' | 'CREDIT';
}

export interface ParseResult {
  parsed: RawParsedRow[];
  failed: number; // Lines that looked like transactions but could not be parsed
}

// ─── Date Normalizer ──────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Attempt to parse common date formats found in Indian and global bank statements.
 * Returns ISO date string (YYYY-MM-DD) or null if unrecognised.
 * Uses direct component formatting to avoid timezone shifts.
 */
export const normalizeRawDate = (raw: string): string | null => {
  const cleaned = raw.trim();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const m = Number.parseInt(mm, 10);
    const d = Number.parseInt(dd, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }

  // YYYY-MM-DD (already ISO)
  const ymd = cleaned.match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    return `${yyyy}-${mm}-${dd}`;
  }

  // DD MMM YYYY  e.g. "01 Sep 2026" or "01-Sep-2026"
  const dMonthY = cleaned.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{4})$/);
  if (dMonthY) {
    const [, dd, mon, yyyy] = dMonthY;
    const mm = MONTH_MAP[mon.toLowerCase()];
    if (mm) {
      return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
    }
  }

  return null;
};

// ─── Amount Parser ────────────────────────────────────────────────────────────

export const parseAmount = (raw: string): number | null => {
  // Strip currency symbols, commas, spaces
  const cleaned = raw.replace(/[₹$€£,\s]/g, '').trim();
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
};

// ─── Multi-line Indian Bank Statement Parser (ICICI / HDFC / SBI) ─────────────

/**
 * Multi-line bank statement parser (e.g. ICICI Bank, HDFC Bank OpTransactionHistory).
 *
 * Pattern:
 * Line 1: [SNo] DD.MM.YYYY [Title / Payee]
 * Lines 2..N-1: Additional transaction remarks, UPI IDs, Cheque numbers
 * Line N: [Amount] [Balance]
 */
const tryIndianBankMultilineFormat = (lines: string[]): ParseResult => {
  const startRegex = /^(?:\d+\s+)?(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4})\s+(.*)$/;
  const txStarts: Array<{ lineIdx: number; date: string; title: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    // Skip header and footer lines
    if (/^(page|total|statement of transactions|saving account|s no\.)/i.test(trimmed)) continue;

    const m = trimmed.match(startRegex);
    if (m) {
      const isoDate = normalizeRawDate(m[1]);
      if (isoDate) {
        txStarts.push({ lineIdx: i, date: isoDate, title: m[2].trim() });
      }
    }
  }

  // Only proceed if a substantial number of transactions match this multi-line pattern
  if (txStarts.length < 2) {
    return { parsed: [], failed: 0 };
  }

  const rawEntries: Array<{
    date: string;
    description: string;
    amount: number;
    balance: number | null;
  }> = [];
  let failed = 0;

  for (let i = 0; i < txStarts.length; i++) {
    const startIdx = txStarts[i].lineIdx;
    const endIdx =
      i < txStarts.length - 1
        ? txStarts[i + 1].lineIdx
        : Math.min(startIdx + 12, lines.length);
    const chunk = lines.slice(startIdx, endIdx).map((l) => l.trim()).filter(Boolean);

    // Look for amount and balance at end of chunk
    let amount: number | null = null;
    let balance: number | null = null;
    let amountLineIdxInChunk = -1;

    for (let j = chunk.length - 1; j >= 0; j--) {
      // Look for two decimal numbers at the end of the line: <amount> <balance>
      const twoNumMatch = chunk[j].match(/([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
      if (twoNumMatch) {
        amount = parseAmount(twoNumMatch[1]);
        balance = parseAmount(twoNumMatch[2]);
        amountLineIdxInChunk = j;
        break;
      }
      // Single amount fallback
      const singleNumMatch = chunk[j].match(/([\d,]+\.\d{2})$/);
      if (singleNumMatch) {
        amount = parseAmount(singleNumMatch[1]);
        amountLineIdxInChunk = j;
        break;
      }
    }

    if (!amount) {
      failed++;
      continue;
    }

    // Collect description from chunk
    const descLines: string[] = [];
    if (txStarts[i].title) descLines.push(txStarts[i].title);

    for (let k = 1; k < chunk.length; k++) {
      if (k === amountLineIdxInChunk) {
        const prefix = chunk[k]
          .replace(/([\d,]+\.\d{2})(\s+[\d,]+\.\d{2})?$/, '')
          .trim();
        if (prefix) descLines.push(prefix);
      } else if (k < amountLineIdxInChunk) {
        descLines.push(chunk[k]);
      }
    }

    const description =
      descLines.join(' ').replace(/\s+/g, ' ').trim() || 'Bank Transaction';
    rawEntries.push({ date: txStarts[i].date, description, amount, balance });
  }

  // Resolve DEBIT vs CREDIT using balance delta
  const parsed: RawParsedRow[] = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    let type: 'DEBIT' | 'CREDIT' = 'DEBIT';

    // 1. Balance delta check
    if (i > 0 && entry.balance !== null && rawEntries[i - 1].balance !== null) {
      const prevBal = rawEntries[i - 1].balance!;
      const currBal = entry.balance;
      if (currBal > prevBal) {
        type = 'CREDIT';
      } else if (currBal < prevBal) {
        type = 'DEBIT';
      }
    } else {
      // Keyword check
      const isCredit = /salary|credit|\bcr\b|deposit|dividend|refund/i.test(
        entry.description,
      );
      type = isCredit ? 'CREDIT' : 'DEBIT';
    }

    parsed.push({
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      type,
    });
  }

  return { parsed, failed };
};

// ─── Generic Single-Line Columnar Bank Statement Parser ───────────────────────

const DATE_PREFIX_RE =
  /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}|\d{1,2}[\s\-][A-Za-z]{3}[\s\-]\d{4})/;

/**
 * Generic columnar parser for text-based bank statements.
 *
 * Expected format:
 *   Date        Description           Debit     Credit
 *   01/09/2026  Swiggy                450.00
 *   03/09/2026  Salary Credit                   50000.00
 */
const tryGenericBankFormat = (lines: string[]): ParseResult => {
  const parsed: RawParsedRow[] = [];
  let failed = 0;

  // Detect header line to find column positions in raw line space
  let debitCol = -1;
  let creditCol = -1;
  let headerLineIdx = -1;

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (
      (lower.includes('date') || lower.includes('txn')) &&
      (lower.includes('debit') || lower.includes('withdrawal') || lower.includes('dr')) &&
      (lower.includes('credit') || lower.includes('deposit') || lower.includes('cr'))
    ) {
      headerLineIdx = i;

      // Find character column indices in this exact line
      const debitMatch = line.search(/debit|withdrawal|\bdr\b/i);
      const creditMatch = line.search(/credit|deposit|\bcr\b/i);

      if (debitMatch !== -1) debitCol = debitMatch;
      if (creditMatch !== -1) creditCol = creditMatch;
      break;
    }
  }

  const startLine = headerLineIdx >= 0 ? headerLineIdx + 1 : 0;
  const colMidpoint =
    debitCol >= 0 && creditCol >= 0 ? (debitCol + creditCol) / 2 : -1;

  for (let i = startLine; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.length < 8) continue;

    // Skip non-transaction lines
    if (/^(page|total|opening|closing|balance|statement|account)/i.test(trimmedLine))
      continue;

    // Match leading date in trimmed line
    const dateMatch = trimmedLine.match(DATE_PREFIX_RE);
    if (!dateMatch) continue;

    const isoDate = normalizeRawDate(dateMatch[1]);
    if (!isoDate) continue;

    // Find where the date ends in rawLine to preserve exact character spacing
    const dateIdxInRaw = rawLine.indexOf(dateMatch[1]);
    const afterDateRaw = rawLine.slice(dateIdxInRaw + dateMatch[1].length);

    // Extract numeric amount candidates
    const numberRegex = /[\d,]+\.\d{2}|(?<=\s)[\d,]+(?=\s|$)/g;
    const matches: Array<{ value: string; index: number }> = [];
    let m: RegExpExecArray | null;

    while ((m = numberRegex.exec(afterDateRaw)) !== null) {
      matches.push({
        value: m[0],
        index: dateIdxInRaw + dateMatch[1].length + m.index,
      });
    }

    if (matches.length === 0) {
      failed++;
      continue;
    }

    // The description sits between date end and first amount start
    const firstAmountPos = matches[0].index;
    const description = rawLine
      .slice(dateIdxInRaw + dateMatch[1].length, firstAmountPos)
      .trim();

    if (matches.length === 1) {
      const amtVal = parseAmount(matches[0].value);
      if (!amtVal) {
        failed++;
        continue;
      }

      let type: 'DEBIT' | 'CREDIT' = 'DEBIT';

      if (colMidpoint >= 0) {
        if (creditCol > debitCol) {
          type = matches[0].index >= colMidpoint ? 'CREDIT' : 'DEBIT';
        } else {
          type = matches[0].index >= colMidpoint ? 'DEBIT' : 'CREDIT';
        }
      } else {
        const isCredit = /salary|credit|\bcr\b|deposit|interest|dividend|refund/i.test(
          description,
        );
        type = isCredit ? 'CREDIT' : 'DEBIT';
      }

      parsed.push({
        date: isoDate,
        description: description || 'Bank Transaction',
        amount: amtVal,
        type,
      });
    } else if (matches.length >= 2) {
      const firstAmt = parseAmount(matches[0].value);
      const secondAmt = parseAmount(matches[1].value);

      if (!firstAmt) {
        failed++;
        continue;
      }

      if (colMidpoint >= 0 && secondAmt) {
        if (matches[0].index < colMidpoint && matches[1].index >= colMidpoint) {
          parsed.push({
            date: isoDate,
            description,
            amount: firstAmt,
            type: 'DEBIT',
          });
          parsed.push({
            date: isoDate,
            description,
            amount: secondAmt,
            type: 'CREDIT',
          });
          continue;
        }
      }

      const isCredit = /salary|credit|\bcr\b|deposit|interest|dividend|refund/i.test(
        description,
      );
      parsed.push({
        date: isoDate,
        description: description || 'Bank Transaction',
        amount: firstAmt,
        type: isCredit ? 'CREDIT' : 'DEBIT',
      });
    }
  }

  return { parsed, failed };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse raw PDF text into an array of RawParsedRow objects.
 *
 * Architecture: This function is the entry point for all bank parsers.
 * It tries each format in order and returns the best result.
 * Supports multi-line Indian bank statements (ICICI, HDFC, SBI) and generic columnar formats.
 *
 * @param text - Raw text extracted from the PDF
 * @returns ParseResult with parsed transactions and failed-line count
 */
export const parseTransactionsFromText = (text: string): ParseResult => {
  const lines = text.split('\n').map((l) => l.replace(/\r/g, ''));

  // 1. Try Indian Bank Multi-line format (ICICI / HDFC / SBI OpTransactionHistory)
  const multilineResult = tryIndianBankMultilineFormat(lines);
  if (multilineResult.parsed.length > 0) {
    logger.info(
      'Transaction parser (Indian Bank format): %d rows extracted, %d failed',
      multilineResult.parsed.length,
      multilineResult.failed,
    );
    return multilineResult;
  }

  // 2. Fall back to generic columnar format
  const genericResult = tryGenericBankFormat(lines);
  logger.info(
    'Transaction parser (Generic format): %d rows extracted, %d failed',
    genericResult.parsed.length,
    genericResult.failed,
  );

  return genericResult;
};
