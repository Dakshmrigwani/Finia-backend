import transactionService from '@/services/transaction.service';
import type { AuthedReq } from '@/types';
import { ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';
import type { GetTransactionsQuery } from '@/services/transaction.service';

const createTransaction: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const transaction = await transactionService.createTransaction(userId, req.body);
  const payload = ApiResponse.ok('Transaction created successfully', transaction);
  sendResponse(res, httpStatus.CREATED, payload);
});

const getTransactions: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const query = req.query as unknown as GetTransactionsQuery;
  const result = await transactionService.getTransactions(userId, query);
  const payload = ApiResponse.ok('Transactions retrieved successfully', result);
  sendResponse(res, httpStatus.OK, payload);
});

const getTransaction: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const transactionId = Array.isArray(req.params.transactionId)
    ? req.params.transactionId[0]
    : req.params.transactionId;
  const transaction = await transactionService.getTransactionById(transactionId, userId);
  const payload = ApiResponse.ok('Transaction retrieved successfully', transaction);
  sendResponse(res, httpStatus.OK, payload);
});

const updateTransaction: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const transactionId = Array.isArray(req.params.transactionId)
    ? req.params.transactionId[0]
    : req.params.transactionId;
  const transaction = await transactionService.updateTransaction(transactionId, userId, req.body);
  const payload = ApiResponse.ok('Transaction updated successfully', transaction);
  sendResponse(res, httpStatus.OK, payload);
});

const deleteTransaction: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const transactionId = Array.isArray(req.params.transactionId)
    ? req.params.transactionId[0]
    : req.params.transactionId;
  await transactionService.deleteTransaction(transactionId, userId);
  const payload = ApiResponse.ok('Transaction deleted successfully', null);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  createTransaction,
  getTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
};
