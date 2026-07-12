import { strictZod as z } from '@/utils/strict-zod';

const createGoal = {
  body: z.object({
    goalName: z.string().min(1, 'Goal name is required'),
    goalType: z.enum(['EMERGENCY_FUND', 'VACATION', 'CAR', 'HOME', 'GADGET', 'EDUCATION', 'INVESTMENT', 'CUSTOM']).optional(),
    coverImage: z.string().url('Invalid cover image URL').optional().nullable(),
    targetAmount: z.number().positive('Target amount must be greater than zero'),
    currentSavedAmount: z.number().nonnegative('Current saved amount cannot be negative').optional(),
    targetDate: z.coerce.date().optional().nullable(),
    projectedCompletionDate: z.coerce.date().optional().nullable(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
    smartSaverEnabled: z.boolean().optional(),
    automationMinBalance: z.number().nonnegative().optional().nullable(),
    automationFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
    createdVia: z.enum(['MANUAL', 'AI_PLAN']).optional(),
  }),
};

const updateGoal = {
  params: z.object({
    goalId: z.string().uuid(),
  }),
  body: z
    .object({
      goalName: z.string().min(1).optional(),
      goalType: z.enum(['EMERGENCY_FUND', 'VACATION', 'CAR', 'HOME', 'GADGET', 'EDUCATION', 'INVESTMENT', 'CUSTOM']).optional(),
      coverImage: z.string().url('Invalid cover image URL').optional().nullable(),
      targetAmount: z.number().positive().optional(),
      currentSavedAmount: z.number().nonnegative().optional(),
      targetDate: z.coerce.date().optional().nullable(),
      projectedCompletionDate: z.coerce.date().optional().nullable(),
      status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
      smartSaverEnabled: z.boolean().optional(),
      automationMinBalance: z.number().nonnegative().optional().nullable(),
      automationFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
      createdVia: z.enum(['MANUAL', 'AI_PLAN']).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const getGoal = {
  params: z.object({
    goalId: z.string().uuid(),
  }),
};

const deleteGoal = {
  params: z.object({
    goalId: z.string().uuid(),
  }),
};

export default {
  createGoal,
  updateGoal,
  getGoal,
  deleteGoal,
};
