import type { RequestHandler } from 'express';
import { ApiError, asyncWrapper } from '@/utils';
import httpStatus from 'http-status';
import type { AuthedReq } from '@/types';
import { importCsvStatement } from './service';
import type { DateFormat } from './normalize';

/**
 * POST /transactions/import (also mounted at /transaction/import)
 *
 * Authenticated, multipart/form-data.
 * Field name: 'file'
 * Optional field: 'dateFormat' ("DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD")
 *
 * Response (200):
 * {
 *   "imported": number,
 *   "skipped": number,
 *   "failed": [{ "row": number, "reason": string }],
 *   "warnings": string[],
 *   "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } | null
 * }
 */
export const importCsvController: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;

  const file = (req as AuthedReq & { file?: Express.Multer.File }).file;
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No CSV file uploaded or file is empty.');
  }

  const rawDateFormat = req.body?.dateFormat as string | undefined;
  let dateFormat: DateFormat | undefined;

  if (rawDateFormat) {
    const validFormats: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
    if (!validFormats.includes(rawDateFormat as DateFormat)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Invalid dateFormat '${rawDateFormat}'. Must be one of: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD`,
      );
    }
    dateFormat = rawDateFormat as DateFormat;
  }

  const result = await importCsvStatement(userId, file.buffer, dateFormat);

  res.status(httpStatus.OK).json(result);
});

export default {
  importCsvController,
};
