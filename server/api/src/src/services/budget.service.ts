import prisma from '@/lib/prisma';
import type { Budget as PrismaBudget } from '@/types';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';

const createBudget = async (userId: string, budgetBody: { category: string; amount?: number; limit?: number }) => {
  if (!budgetBody.category) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Category is required');
  }

  // Check if budget for this category already exists for the user
  const existingBudget = await prisma.budget.findFirst({
    where: {
      userId,
      category: budgetBody.category,
    },
  });

  if (existingBudget) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Budget for category "${budgetBody.category}" already exists`,
    );
  }

  return prisma.budget.create({
    data: {
      userId,
      category: budgetBody.category,
      amount: budgetBody.amount ?? 0,
      limit: budgetBody.limit ?? 0,
    },
  });
};

const getBudgetById = async (budgetId: string) => {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
  });

  if (!budget) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Budget not found');
  }

  return budget;
};

const getUserBudgets = async (userId: string) => {
  const budgets = await prisma.budget.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return budgets;
};

const getBudgetByCategory = async (userId: string, category: string) => {
  const budget = await prisma.budget.findFirst({
    where: {
      userId,
      category,
    },
  });

  if (!budget) {
    throw new ApiError(httpStatus.NOT_FOUND, `Budget for category "${category}" not found`);
  }

  return budget;
};

const updateBudgetById = async (budgetId: string, updateBody: Partial<PrismaBudget>) => {
  const budget = await getBudgetById(budgetId);

  // If changing category, check if new category already exists
  if (updateBody.category && updateBody.category !== budget.category) {
    const existingBudget = await prisma.budget.findFirst({
      where: {
        userId: budget.userId,
        category: updateBody.category,
      },
    });

    if (existingBudget) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Budget for category "${updateBody.category}" already exists`,
      );
    }
  }

  return prisma.budget.update({
    where: { id: budgetId },
    data: updateBody,
  });
};

const deleteBudgetById = async (budgetId: string) => {
  const budget = await getBudgetById(budgetId);

  await prisma.budget.delete({
    where: { id: budgetId },
  });

  return budget;
};

export default {
  createBudget,
  getBudgetById,
  getUserBudgets,
  getBudgetByCategory,
  updateBudgetById,
  deleteBudgetById,
};
