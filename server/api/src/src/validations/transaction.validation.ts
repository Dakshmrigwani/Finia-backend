import { strictZod as z } from '@/utils/strict-zod';

// ─── Shared Enums ─────────────────────────────────────────────────────────────

const transactionTypeEnum = z.enum(['FIXED', 'RECURRING', 'VARIABLE', 'WEALTH_MOVEMENT']);

const transactionDirectionEnum = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);

const transactionCategoryEnum = z.enum([
  // FIXED
  'RENT', 'MORTGAGE', 'INSURANCE', 'SUBSCRIPTION', 'EMI', 'SALARY',
  // RECURRING
  'UTILITIES', 'INTERNET', 'MOBILE_PLAN', 'GYM', 'STREAMING', 'SIP',
  // VARIABLE
  'FOOD', 'SHOPPING', 'ENTERTAINMENT', 'TRAVEL', 'HEALTHCARE', 'FUEL',
  // WEALTH_MOVEMENT
  'TRANSFER', 'INVESTMENT', 'WITHDRAWAL', 'TOP_UP', 'DIVIDEND',
  // Shared
  'OTHER',
]);

const recurrenceFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'NONE']);

// ─── Create ───────────────────────────────────────────────────────────────────

const createTransaction = {
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(1000).optional(),
    amount: z.number().positive('Amount must be greater than zero'),
    type: transactionTypeEnum,
    direction: transactionDirectionEnum,
    category: transactionCategoryEnum,
    recurrence: recurrenceFrequencyEnum.optional().default('NONE'),
    date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid date format' }),
    budgetId: z.string().uuid('budgetId must be a valid UUID').optional(),
    note: z.string().max(2000).optional(),
  }),
};

// ─── Get list (with pagination + filters) ────────────────────────────────────

const getTransactions = {
  query: z.object({
    // Pagination
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    sortBy: z.string().optional(),
    // Text search
    search: z.string().optional(),
    // Date filters
    date: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid date format (use YYYY-MM-DD)' })
      .optional(),
    month: z
      .string()
      .regex(/^([1-9]|1[0-2])$/, 'Month must be 1–12')
      .optional(),
    year: z
      .string()
      .regex(/^\d{4}$/, 'Year must be a 4-digit number')
      .optional(),
    dateFrom: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid dateFrom format (use YYYY-MM-DD)' })
      .optional(),
    dateTo: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid dateTo format (use YYYY-MM-DD)' })
      .optional(),
    // Enum filters
    type: transactionTypeEnum.optional(),
    direction: transactionDirectionEnum.optional(),
    category: transactionCategoryEnum.optional(),
    budgetId: z.string().uuid().optional(),
  }),
};

// ─── Get / Delete by ID ───────────────────────────────────────────────────────

const getTransaction = {
  params: z.object({
    transactionId: z.string().uuid('Invalid transaction ID'),
  }),
};

const deleteTransaction = {
  params: z.object({
    transactionId: z.string().uuid('Invalid transaction ID'),
  }),
};

// ─── Update ───────────────────────────────────────────────────────────────────

const updateTransaction = {
  params: z.object({
    transactionId: z.string().uuid('Invalid transaction ID'),
  }),
  body: z
    .object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional(),
      amount: z.number().positive().optional(),
      type: transactionTypeEnum.optional(),
      direction: transactionDirectionEnum.optional(),
      category: transactionCategoryEnum.optional(),
      recurrence: recurrenceFrequencyEnum.optional(),
      date: z
        .string()
        .refine((d) => !Number.isNaN(Date.parse(d)), { message: 'Invalid date format' })
        .optional(),
      budgetId: z.string().uuid('budgetId must be a valid UUID').nullable().optional(),
      note: z.string().max(2000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
};

export default {
  createTransaction,
  getTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
};
