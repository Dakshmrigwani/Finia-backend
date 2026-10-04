import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import multer from 'multer';
import type { Request } from 'express';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const csvFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const isCsvExt = file.originalname.toLowerCase().endsWith('.csv');
  const mime = (file.mimetype || '').toLowerCase();
  const isCsvMime =
    mime === 'text/csv' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/plain' ||
    mime === 'application/csv' ||
    mime === 'text/comma-separated-values';

  if (!isCsvExt && !isCsvMime) {
    return cb(
      new ApiError(
        httpStatus.BAD_REQUEST,
        'Invalid file type. Only CSV files are accepted.',
      ),
    );
  }

  cb(null, true);
};

export const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: MAX_CSV_FILE_SIZE_BYTES,
    files: 1,
  },
});
