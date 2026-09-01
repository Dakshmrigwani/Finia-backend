import { UserRole } from '@/types';
import { strictZod as z } from '@/utils/strict-zod';
import { isPassword } from './custom.validation';

const createUser = {
  body: z.object({
    email: z.string().email(),
    password: isPassword,
    name: z.string(),
    role: z.nativeEnum(UserRole),
  }),
};

const getUsers = {
  query: z.object({
    name: z.string().optional(),
    search: z.string().optional(),
    role: z.preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.nativeEnum(UserRole).optional()),
    sortBy: z.string().optional(),
    limit: z.string().optional(),
    page: z.string().optional(),
  }),
};

const updateProfile = {
  body: z
    .object({
      name: z.string().optional(),
      dob: z.union([z.string(), z.date()]).optional().nullable(),
      income: z.number().optional(),
      maritalStatus: z.string().optional().nullable(),
      martialStatus: z.string().optional().nullable(),
      motive: z.string().optional().nullable(),
      spendMostly: z.string().optional().nullable(),
      spendMostlyOn: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
      theme: z.string().optional().nullable(),
      currency: z.string().optional().nullable(),
      notifications: z.boolean().optional(),
      biometric: z.boolean().optional(),
      twoFactor: z.boolean().optional(),
      aiNudges: z.boolean().optional(),
      newPassword: isPassword.optional(),
      oldPassword: isPassword.optional(),
    })
    .refine((data) => (!data.newPassword && !data.oldPassword) || (data.newPassword && data.oldPassword), {
      message: 'Both oldPassword and newPassword must be provided together',
      path: ['newPassword'],
    }),
};

const getUser = {
  params: z.object({
    userId: z.string().uuid(),
  }),
};

const updateUser = {
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z
    .object({
      email: z.string().email().optional(),
      password: isPassword.optional(),
      name: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const deleteUser = {
  params: z.object({
    userId: z.string().uuid(),
  }),
};

export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateProfile,
};
