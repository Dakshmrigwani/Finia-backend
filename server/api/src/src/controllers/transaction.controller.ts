import transactionService from '@/services/transaction.service';
import { importTransactionsFromPdf } from '@/services/transaction-import.service';
import type { AuthedReq } from '@/types';
import { ApiError, ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';
import type { GetTransactionsQuery } from '@/services/transaction.service';

// ─── CRUD Handlers ────────────────────────────────────────────────────────────

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

// ─── PDF Import ───────────────────────────────────────────────────────────────

/**
 * POST /transaction/import/pdf
 *
 * Accepts a multipart/form-data PDF upload and runs the full import pipeline.
 * userId is sourced exclusively from the JWT — never from the request body.
 * Returns an ImportSummary (totalExtracted, inserted, duplicates, failed).
 */
const importPdf: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId, currency } = (req as AuthedReq).user;

  // multer places the file at req.file after successful fileFilter validation
  const file = (req as AuthedReq & { file?: Express.Multer.File }).file;
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No PDF file uploaded or file is empty.');
  }

  const summary = await importTransactionsFromPdf(userId, file.buffer, currency ?? null);
  const payload = ApiResponse.ok('PDF import completed', summary);
  sendResponse(res, httpStatus.OK, payload);
});

// ─── Exports ─────────────────────────────────────────────────────────────────

export default {
  createTransaction,
  getTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  importPdf,
};
