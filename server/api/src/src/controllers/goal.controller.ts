import goalService from '@/services/goal.service';
import type { AuthedReq } from '@/types';
import { ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const createGoal: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const goal = await goalService.createGoal(userId, req.body);
  const payload = ApiResponse.ok('Goal created successfully', goal);
  sendResponse(res, httpStatus.CREATED, payload);
});

const getGoals: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const goals = await goalService.getUserGoals(userId);
  const payload = ApiResponse.ok('Goals retrieved successfully', goals);
  sendResponse(res, httpStatus.OK, payload);
});

const getGoal: RequestHandler = asyncWrapper(async (req, res) => {
  const goal = await goalService.getGoalById(req.params.goalId as string);
  const payload = ApiResponse.ok('Goal retrieved successfully', goal);
  sendResponse(res, httpStatus.OK, payload);
});

const updateGoal: RequestHandler = asyncWrapper(async (req, res) => {
  const goal = await goalService.updateGoalById(req.params.goalId as string, req.body);
  const payload = ApiResponse.ok('Goal updated successfully', goal);
  sendResponse(res, httpStatus.OK, payload);
});

const deleteGoal: RequestHandler = asyncWrapper(async (req, res) => {
  await goalService.deleteGoalById(req.params.goalId as string);
  const payload = ApiResponse.ok('Goal deleted successfully', null);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  createGoal,
  getGoals,
  getGoal,
  updateGoal,
  deleteGoal,
};
