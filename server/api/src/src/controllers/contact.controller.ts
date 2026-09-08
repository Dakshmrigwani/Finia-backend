import * as contactService from '@/services/contact.service';
import type { AuthedReq } from '@/types';
import { ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const syncContacts: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const { contacts } = req.body;

  const result = await contactService.syncUserContacts(userId, contacts);
  const payload = ApiResponse.ok('Contacts synced successfully', result);
  sendResponse(res, httpStatus.OK, payload);
});

const getContacts: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const result = await contactService.getUserContacts(userId, req.query);
  const payload = ApiResponse.ok('Contacts retrieved successfully', result);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  syncContacts,
  getContacts,
};
