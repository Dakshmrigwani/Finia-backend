import type { Response } from 'express';
import type { IApiResponse } from './apiResponse';

const sendResponse = <T>(
  res: Response,
  statusCode: number,
  payload: IApiResponse<T>,
): void => {
  res.status(statusCode).json(payload);
};

export default sendResponse;