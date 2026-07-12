import prisma from '@/lib/prisma';
import type { Goal as PrismaGoal } from '@/types';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';

const createGoal = async (userId: string, goalBody: Partial<PrismaGoal>) => {
  const existingGoal = await prisma.goal.findFirst({
    where: {
      userId,
      goalName: goalBody.goalName,
    },
  });

  if (existingGoal) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Goal with name "${goalBody.goalName}" already exists`,
    );
  }

  return prisma.goal.create({
    data: {
      userId,
      ...goalBody,
    } as any,
  });
};

const getGoalById = async (goalId: string) => {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Goal not found');
  }

  return goal;
};

const getUserGoals = async (userId: string) => {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return goals;
};

const updateGoalById = async (goalId: string, updateBody: Partial<PrismaGoal>) => {
  const goal = await getGoalById(goalId);

  // If changing name, check if new name already exists for this user
  if (updateBody.goalName && updateBody.goalName !== goal.goalName) {
    const existingGoal = await prisma.goal.findFirst({
      where: {
        userId: goal.userId,
        goalName: updateBody.goalName,
      },
    });

    if (existingGoal) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Goal with name "${updateBody.goalName}" already exists`,
      );
    }
  }

  return prisma.goal.update({
    where: { id: goalId },
    data: updateBody as any,
  });
};

const deleteGoalById = async (goalId: string) => {
  const goal = await getGoalById(goalId);

  await prisma.goal.delete({
    where: { id: goalId },
  });

  return goal;
};

export default {
  createGoal,
  getGoalById,
  getUserGoals,
  updateGoalById,
  deleteGoalById,
};
