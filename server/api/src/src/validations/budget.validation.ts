import { strictZod as z } from '@/utils/strict-zod';

const createBudget = {
  body: z.object({
    category: z.string().min(1, 'Category is required'),
    amount: z.number().positive('Amount must be greater than zero'),
    limit: z.number().positive('Limit must be greater than zero'),
  }),
};

const updateBudget = {
  params: z.object({
    budgetId: z.string().uuid(),
  }),
  body: z
    .object({
      category: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      limit: z.number().positive().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const getBudget = {
  params: z.object({
    budgetId: z.string().uuid(),
  }),
};

const deleteBudget = {
  params: z.object({
    budgetId: z.string().uuid(),
  }),
};

const getBudgetByCategory = {
  params: z.object({
    category: z.string().min(1),
  }),
};

export default {
  createBudget,
  updateBudget,
  getBudget,
  deleteBudget,
  getBudgetByCategory,
};
