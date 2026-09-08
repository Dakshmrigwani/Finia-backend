import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/config/logger';
import type { TransactionDirection, TransactionCategory, TransactionType } from '@/types';
import { categorizeTransaction } from './transaction-categorizer.service';

export interface RawSmsMessage {
  id?: string;
  address?: string;
  body: string;
  date?: number | string | Date;
}

export interface ExtractedSmsTransaction {
  date: Date;
  merchant: string;
  amount: number;
  direction: TransactionDirection;
  category: TransactionCategory;
  type: TransactionType;
  rawType: 'DEBIT' | 'CREDIT';
  currency: string;
  importFingerprint: string;
  rawSmsBody: string;
}

export interface SmsImportSummary {
  totalReceived: number;
  transactionsDetected: number;
  inserted: number;
  duplicates: number;
  skippedNonTransactions: number;
}

// ─── Known Bank Sender Mapping ────────────────────────────────────────────────

const KNOWN_SENDERS: Record<string, string> = {
  HDFCBK: 'HDFC Bank',
  AXISBK: 'Axis Bank',
  SBIINB: 'State Bank of India',
  SBIPAY: 'SBI Pay',
  ICICIB: 'ICICI Bank',
  KOTAKB: 'Kotak Bank',
  PAYTMB: 'Paytm Payments Bank',
  PAYTM: 'Paytm',
  GPAY: 'Google Pay',
  PHNPE: 'PhonePe',
  PHONEPE: 'PhonePe',
  AMZPAY: 'Amazon Pay',
  BOBTXN: 'Bank of Baroda',
  PNBSMS: 'Punjab National Bank',
  YESBNK: 'Yes Bank',
  INDUSB: 'IndusInd Bank',
  CITIBK: 'Citi Bank',
  SCBANK: 'Standard Chartered',
  RBLBNK: 'RBL Bank',
  FEDERAL: 'Federal Bank',
  IDFCFB: 'IDFC First Bank',
  AUBNK: 'AU Small Finance Bank',
};

const cleanSenderName = (rawSender?: string): string => {
  if (!rawSender) return 'Bank Transaction';
  // Strip telecomm prefixes (e.g. "VK-HDFCBK" -> "HDFCBK", "AD-AXISBK" -> "AXISBK")
  const cleaned = rawSender.replace(/^[a-zA-Z]{2}-/i, '').toUpperCase().trim();
  for (const [key, name] of Object.entries(KNOWN_SENDERS)) {
    if (cleaned.includes(key)) return name;
  }
  return cleaned || 'Bank Transaction';
};

// ─── Filter Checks ────────────────────────────────────────────────────────────

/**
 * Check whether an SMS message is a non-transaction message
 * (such as an OTP verification, promotional offer, or generic notification).
 */
export const isNonTransactionMessage = (body: string): boolean => {
  const text = body.toLowerCase();

  // 1. Authorization OTPs (even if mentioning an amount, an OTP is not a completed transaction)
  const isOtp =
    /\b(otp|one time password|verification code|security code|secret code|login code)\b/i.test(text) &&
    /\b(is your|otp is|use otp|valid for|do not share|never share|secret|verification)\b/i.test(text);

  if (isOtp) return true;

  // 2. Promotional / Marketing spam without debit/credit confirmation
  const isPromo =
    /\b(apply now|pre-approved|congratulations|flat \d+% off|use promo|coupon code|claim your|win up to|special offer|personal loan approved)\b/i.test(
      text,
    ) && !/\b(debited|credited|spent on|paid to)\b/i.test(text);

  if (isPromo) return true;

  // 3. Telecom/carrier pack alerts without debit confirmation
  const isTelecomAlert =
    /\b(daily.*data|data.*pack|data.*exhausted|high speed data|pack validity|plan expires|recharge due|recharge now|caller tune|balance alert)\b/i.test(
      text,
    ) && !/\b(debited|credited|payment received)\b/i.test(text);

  if (isTelecomAlert) return true;

  // 4. Security / login alerts
  const isSecurityAlert =
    /\b(password changed|login detected|profile updated|new login|registered successfully)\b/i.test(text);

  if (isSecurityAlert) return true;

  return false;
};

/**
 * Extracts a numeric transaction amount from the SMS body.
 */
const extractAmount = (body: string): number | null => {
  // Matches "Rs. 1,200.50", "INR 500", "₹450.00", "$50.00", "USD 100", etc.
  const regexes = [
    /(?:rs\.?|inr|₹|\$|usd|eur|gbp)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|₹|\$|usd)\b/i,
    /(?:amt|amount|txn of|paid)\s*(?:of|is|:)?\s*(?:rs\.?|inr|₹|\$)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
  ];

  for (const regex of regexes) {
    const match = body.match(regex);
    if (match && match[1]) {
      const rawNum = match[1].replace(/,/g, '');
      const parsed = Number.parseFloat(rawNum);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

/**
 * Extracts the merchant or counterparty from the SMS body.
 */
const extractMerchant = (body: string, sender?: string): string => {
  // Pattern 1: "...at SWIGGY on...", "...to ZOMATO ref...", "...towards ELECTRICITY BILL..."
  const merchantPatterns = [
    /(?:at|to|towards|in info|for)\s+([A-Za-z0-9\s._&-]{2,35}?)(?:\s+(?:on|ref|avl|bal|using|via|dated|txn|through|\.|$))/i,
    /(?:vpa|upi id)\s+([a-zA-Z0-9.\-_@]{3,35})/i,
    /(?:transferred to)\s+([A-Za-z0-9\s._&-]{2,35}?)(?:\s+(?:on|ref|avl|bal|\.|$))/i,
  ];

  for (const pat of merchantPatterns) {
    const match = body.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/[\x00-\x1F\x7F]/g, '');
      // Filter out false matches that are purely stopwords
      if (!/^(the|your|a|an|account|card|bank)$/i.test(candidate) && candidate.length >= 2) {
        return candidate.slice(0, 255);
      }
    }
  }

  // Fallback to sender bank / provider
  return cleanSenderName(sender);
};

/**
 * Parses date from SMS message or explicit date in body.
 */
const extractDate = (rawDate?: number | string | Date, body?: string): Date => {
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Look for date in body e.g. "08-09-2026", "08/09/26", "08-Sep-26"
  if (body) {
    const dateMatch = body.match(/\b(\d{1,2}[-/](?:\d{1,2}|[A-Za-z]{3})[-/]\d{2,4})\b/);
    if (dateMatch && dateMatch[1]) {
      const parsed = new Date(dateMatch[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return new Date();
};

/**
 * Detect direction (INCOME, EXPENSE, TRANSFER) and rawType ('DEBIT' | 'CREDIT')
 */
const resolveSmsDirection = (
  body: string,
): { direction: TransactionDirection; rawType: 'DEBIT' | 'CREDIT' } | null => {
  const text = body.toLowerCase();

  const isCredit = /\b(credited|credit|received|deposited|refunded|refund|salary)\b/i.test(text);
  const isDebit = /\b(debited|debit|spent|paid|charged|withdrawn|purchase|deducted|sent)\b/i.test(text);
  const isTransfer = /\b(transfer|transferred|neft|imps|rtgs|upi|vpa)\b/i.test(text);

  if (isCredit) {
    return {
      direction: isTransfer ? 'TRANSFER' : 'INCOME',
      rawType: 'CREDIT',
    };
  }

  if (isDebit) {
    return {
      direction: isTransfer ? 'TRANSFER' : 'EXPENSE',
      rawType: 'DEBIT',
    };
  }

  // If there's an amount and "txn of" or "payment of"
  if (/\b(txn of|payment of|transaction of)\b/i.test(text)) {
    return {
      direction: 'EXPENSE',
      rawType: 'DEBIT',
    };
  }

  return null;
};

// ─── Deterministic SMS Transaction Fingerprint ───────────────────────────────

export const generateSmsFingerprint = (
  userId: string,
  tx: { date: Date; merchant: string; amount: number; rawType: string },
): string => {
  const datePart = tx.date.toISOString().slice(0, 10);
  const raw = [
    userId,
    datePart,
    tx.merchant.toLowerCase().trim(),
    tx.amount.toFixed(2),
    tx.rawType,
    'SMS',
  ].join('|');

  return createHash('sha256').update(raw).digest('hex');
};

// ─── Parse Single SMS ─────────────────────────────────────────────────────────

export const parseSmsMessage = (
  userId: string,
  msg: RawSmsMessage,
  userCurrency?: string | null,
): ExtractedSmsTransaction | null => {
  if (!msg.body || typeof msg.body !== 'string') {
    return null;
  }

  // 1. Filter out OTPs, promotional, service alerts
  if (isNonTransactionMessage(msg.body)) {
    return null;
  }

  // 2. Detect direction & rawType
  const dirInfo = resolveSmsDirection(msg.body);
  if (!dirInfo) {
    return null;
  }

  // 3. Extract amount
  const amount = extractAmount(msg.body);
  if (!amount || amount <= 0) {
    return null;
  }

  // 4. Extract merchant / counterparty
  const merchant = extractMerchant(msg.body, msg.address);

  // 5. Extract date
  const date = extractDate(msg.date, msg.body);

  // 6. Categorize
  const { category, type } = categorizeTransaction(merchant);

  // 7. Fingerprint
  const fingerprint = generateSmsFingerprint(userId, {
    date,
    merchant,
    amount,
    rawType: dirInfo.rawType,
  });

  return {
    date,
    merchant,
    amount,
    direction: dirInfo.direction,
    category,
    type,
    rawType: dirInfo.rawType,
    currency: userCurrency || 'INR',
    importFingerprint: fingerprint,
    rawSmsBody: msg.body,
  };
};

// ─── Batch SMS Import Service ─────────────────────────────────────────────────

export const importSmsTransactions = async (
  userId: string,
  messages: RawSmsMessage[],
  userCurrency?: string | null,
): Promise<SmsImportSummary> => {
  let skippedNonTransactions = 0;
  const detectedTransactions: ExtractedSmsTransaction[] = [];

  for (const msg of messages) {
    const parsed = parseSmsMessage(userId, msg, userCurrency);
    if (!parsed) {
      skippedNonTransactions++;
    } else {
      detectedTransactions.push(parsed);
    }
  }

  if (detectedTransactions.length === 0) {
    return {
      totalReceived: messages.length,
      transactionsDetected: 0,
      inserted: 0,
      duplicates: 0,
      skippedNonTransactions,
    };
  }

  // Query existing fingerprints for deduplication
  const fingerprints = detectedTransactions.map((tx) => tx.importFingerprint);
  const existing = await prisma.transaction.findMany({
    where: {
      userId,
      importFingerprint: { in: fingerprints },
    },
    select: { importFingerprint: true },
  });

  const existingSet = new Set(existing.map((e) => e.importFingerprint).filter(Boolean) as string[]);

  // Deduplicate within the incoming batch as well
  const seenInBatch = new Set<string>();
  const toInsert: ExtractedSmsTransaction[] = [];
  let duplicateCount = 0;

  for (const tx of detectedTransactions) {
    if (existingSet.has(tx.importFingerprint) || seenInBatch.has(tx.importFingerprint)) {
      duplicateCount++;
    } else {
      seenInBatch.add(tx.importFingerprint);
      toInsert.push(tx);
    }
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const insertData = toInsert.map((tx) => ({
      userId,
      title: tx.merchant,
      description: `Imported from SMS: ${tx.rawSmsBody.slice(0, 200)}`,
      amount: tx.amount,
      type: tx.type,
      direction: tx.direction,
      category: tx.category,
      recurrence: 'NONE' as const,
      date: tx.date,
      source: 'SMS' as const,
      importFingerprint: tx.importFingerprint,
    }));

    const result = await prisma.transaction.createMany({
      data: insertData,
      skipDuplicates: true,
    });
    inserted = result.count;
  }

  logger.info(
    'SMS import for user %s: %d received, %d detected, %d inserted, %d duplicates, %d non-tx skipped',
    userId,
    messages.length,
    detectedTransactions.length,
    inserted,
    duplicateCount,
    skippedNonTransactions,
  );

  return {
    totalReceived: messages.length,
    transactionsDetected: detectedTransactions.length,
    inserted,
    duplicates: duplicateCount,
    skippedNonTransactions,
  };
};
