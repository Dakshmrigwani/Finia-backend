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
  const budgetId = Array.isArray(req.params.budgetId) ? req.params.budgetId[0] : req.params.budgetId;
  const budget = await budgetService.getBudgetById(budgetId);
  const payload = ApiResponse.ok("Budget retrieved successfully", budget);
  sendResponse(res, httpStatus.OK, payload);
});

const getBudgetByCategory: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const category = Array.isArray(req.params.category) ? req.params.category[0] : req.params.category;
  const budget = await budgetService.getBudgetByCategory(userId, category);
  const payload = ApiResponse.ok("Budget retrieved successfully", budget);
  sendResponse(res, httpStatus.OK, payload);
});

const updateBudget: RequestHandler = asyncWrapper(async (req, res) => {
  const budgetId = Array.isArray(req.params.budgetId) ? req.params.budgetId[0] : req.params.budgetId;
  const budget = await budgetService.updateBudgetById(budgetId, req.body);
  const payload = ApiResponse.ok("Budget updated successfully", budget);
  sendResponse(res, httpStatus.OK, payload);
});

const deleteBudget: RequestHandler = asyncWrapper(async (req, res) => {
  const budgetId = Array.isArray(req.params.budgetId) ? req.params.budgetId[0] : req.params.budgetId;
  await budgetService.deleteBudgetById(budgetId);
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