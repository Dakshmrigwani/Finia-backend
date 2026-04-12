import budgetService from '@/services/budget.service';
import type { AuthedReq } from '@/types';
import { pick, ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const createBudget: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const budget = await budgetService.createBudget(userId, req.body);
  const payload = ApiResponse.ok("Budget created successfully", budget);
  sendResponse(res, httpStatus.CREATED, payload);
});

const getBudgets: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const budgets = await budgetService.getUserBudgets(userId);
  const payload = ApiResponse.ok("Budgets retrieved successfully", budgets);
  sendResponse(res, httpStatus.OK, payload);
});

const getBudget: RequestHandler = asyncWrapper(async (req, res) => {
  const budget = await budgetService.getBudgetById(req.params.budgetId);
  const payload = ApiResponse.ok("Budget retrieved successfully", budget);
  sendResponse(res, httpStatus.OK, payload);
});

const getBudgetByCategory: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const { category } = req.params;
  const budget = await budgetService.getBudgetByCategory(userId, category);
  const payload = ApiResponse.ok("Budget retrieved successfully", budget);
  sendResponse(res, httpStatus.OK, payload);
});

const updateBudget: RequestHandler = asyncWrapper(async (req, res) => {
  const budget = await budgetService.updateBudgetById(req.params.budgetId, req.body);
  const payload = ApiResponse.ok("Budget updated successfully", budget);
  sendResponse(res, httpStatus.OK, payload);
});

const deleteBudget: RequestHandler = asyncWrapper(async (req, res) => {
  await budgetService.deleteBudgetById(req.params.budgetId);
  const payload = ApiResponse.ok("Budget deleted successfully", null);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  createBudget,
  getBudgets,
  getBudget,
  getBudgetByCategory,
  updateBudget,
  deleteBudget,
};