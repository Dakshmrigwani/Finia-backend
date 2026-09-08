import type { TransactionCategory, TransactionType } from '@/types';

// ─── Rule Tables ──────────────────────────────────────────────────────────────

/**
 * Merchant keyword → TransactionCategory
 * Keywords are matched case-insensitively as substrings of the merchant name.
 * Order matters — first match wins.
 *
 * To add new merchants: add entries here.
 * Future: replace this entire function with AI/ML categorization.
 */
const CATEGORY_RULES: Array<{ pattern: RegExp; category: TransactionCategory }> = [
  // ── Food & Dining ────────────────────────────────────────────────
  { pattern: /swiggy|zomato|dominos|pizza|kfc|mcdonalds|burger|subway|dunkin|starbucks|cafe|restaurant|food|dining|barbeque|bbn|eatery|mess/i, category: 'FOOD' },

  // ── Travel & Transport ───────────────────────────────────────────
  { pattern: /uber|ola|rapido|auto|cab|taxi|metro|irctc|railways|airline|indigo|spicejet|air india|makemytrip|yatra|goibibo/i, category: 'TRAVEL' },

  // ── Fuel ────────────────────────────────────────────────────────
  { pattern: /petrol|diesel|fuel|hp petro|indian oil|bharat petroleum|bpcl|hpcl/i, category: 'FUEL' },

  // ── Shopping ────────────────────────────────────────────────────
  { pattern: /amazon|flipkart|myntra|ajio|nykaa|meesho|shopsy|zepto|blinkit|bigbasket|grofers|dmart|reliance|jiomart|snapdeal|tatacliq/i, category: 'SHOPPING' },

  // ── Entertainment ────────────────────────────────────────────────
  { pattern: /netflix|prime video|disney|hotstar|zee5|sonyliv|youtube premium|bookmyshow|pvr|inox|movie/i, category: 'ENTERTAINMENT' },

  // ── Streaming ────────────────────────────────────────────────────
  { pattern: /spotify|apple music|gaana|jiosavan|amazon music|wynk/i, category: 'STREAMING' },

  // ── Utilities ────────────────────────────────────────────────────
  { pattern: /electricity|water bill|gas bill|maintenance|society|municipal|civic|bescom|msedcl|tpddl|adani electricity/i, category: 'UTILITIES' },

  // ── Internet / Mobile ────────────────────────────────────────────
  { pattern: /airtel|jio|bsnl|vi |vodafone|idea|broadband|internet|wifi|recharge/i, category: 'INTERNET' },

  // ── Mobile Plan ──────────────────────────────────────────────────
  { pattern: /mobile plan|postpaid|prepaid plan/i, category: 'MOBILE_PLAN' },

  // ── Gym / Fitness ────────────────────────────────────────────────
  { pattern: /gym|fitness|cult\.fit|gold.?s gym|anytime fitness|yoga/i, category: 'GYM' },

  // ── Insurance ────────────────────────────────────────────────────
  { pattern: /insurance|lic|hdfc life|icici pru|sbi life|term plan|health cover|mediclaim/i, category: 'INSURANCE' },

  // ── EMI / Loans ──────────────────────────────────────────────────
  { pattern: /emi|equated monthly|loan repay|home loan|car loan|personal loan|emi debit/i, category: 'EMI' },

  // ── Rent / Mortgage ──────────────────────────────────────────────
  { pattern: /rent|landlord|lease|mortgage|housing loan/i, category: 'RENT' },

  // ── Subscriptions ────────────────────────────────────────────────
  { pattern: /subscription|annual fee|renewal|membership/i, category: 'SUBSCRIPTION' },

  // ── Healthcare ───────────────────────────────────────────────────
  { pattern: /pharmacy|chemist|medplus|apollo pharmacy|hospital|clinic|doctor|dentist|lab test|diagnostic|healthcare|practo/i, category: 'HEALTHCARE' },

  // ── Investment / SIP ─────────────────────────────────────────────
  { pattern: /mutual fund|sip|zerodha|groww|kuvera|paytm money|coin by zerodha|nps|ppf|demat|ipo/i, category: 'INVESTMENT' },

  // ── Dividends ────────────────────────────────────────────────────
  { pattern: /dividend|div payout/i, category: 'DIVIDEND' },

  // ── Salary / Income ──────────────────────────────────────────────
  { pattern: /salary|sal credit|payroll|stipend|wages|bonus|incentive|income/i, category: 'SALARY' },

  // ── Transfers ────────────────────────────────────────────────────
  { pattern: /neft|rtgs|imps|upi transfer|transfer to|transfer from|self transfer|fund transfer/i, category: 'TRANSFER' },

  // ── Top-up / Wallet ──────────────────────────────────────────────
  { pattern: /paytm|phonepe|gpay|google pay|bhim|wallet|top.?up|add money/i, category: 'TOP_UP' },

  // ── Withdrawal ───────────────────────────────────────────────────
  { pattern: /atm withdrawal|cash withdrawal|atm wd|atm cash/i, category: 'WITHDRAWAL' },
];

/**
 * Category → TransactionType mapping.
 * Drives how the transaction is classified in the data model.
 */
const CATEGORY_TO_TYPE: Record<TransactionCategory, TransactionType> = {
  // FIXED
  RENT: 'FIXED',
  MORTGAGE: 'FIXED',
  INSURANCE: 'FIXED',
  SUBSCRIPTION: 'FIXED',
  EMI: 'FIXED',
  SALARY: 'FIXED',
  // RECURRING
  UTILITIES: 'RECURRING',
  INTERNET: 'RECURRING',
  MOBILE_PLAN: 'RECURRING',
  GYM: 'RECURRING',
  STREAMING: 'RECURRING',
  SIP: 'RECURRING',
  // VARIABLE
  FOOD: 'VARIABLE',
  SHOPPING: 'VARIABLE',
  ENTERTAINMENT: 'VARIABLE',
  TRAVEL: 'VARIABLE',
  HEALTHCARE: 'VARIABLE',
  FUEL: 'VARIABLE',
  // WEALTH_MOVEMENT
  TRANSFER: 'WEALTH_MOVEMENT',
  INVESTMENT: 'WEALTH_MOVEMENT',
  WITHDRAWAL: 'WEALTH_MOVEMENT',
  TOP_UP: 'WEALTH_MOVEMENT',
  DIVIDEND: 'WEALTH_MOVEMENT',
  // Fallback
  OTHER: 'VARIABLE',
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CategorizationResult {
  category: TransactionCategory;
  type: TransactionType;
}

/**
 * Categorize a transaction by its merchant / description string.
 *
 * This is a pure rule-based categorizer — no LLM calls.
 * It is intentionally kept as a separate, swappable service:
 *
 *   Current:  rule-based (this file)
 *   Future:   AI/ML model → user correction → improved model
 *
 * @param merchant - Cleaned merchant name / description
 * @returns { category, type } — falls back to OTHER / VARIABLE when no rule matches
 */
export const categorizeTransaction = (merchant: string): CategorizationResult => {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(merchant)) {
      return {
        category: rule.category,
        type: CATEGORY_TO_TYPE[rule.category],
      };
    }
  }

  return { category: 'OTHER', type: 'VARIABLE' };
};
