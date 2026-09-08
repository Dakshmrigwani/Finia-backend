import { importSmsTransactions } from '@/services/sms-filter.service';
import type { AuthedReq } from '@/types';
import { ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const syncSms: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId, currency } = (req as AuthedReq).user;
  const { messages } = req.body;

  const summary = await importSmsTransactions(userId, messages, currency);
  const payload = ApiResponse.ok('SMS transactions processed successfully', summary);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  syncSms,
};
