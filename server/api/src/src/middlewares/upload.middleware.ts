import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import multer from 'multer';
import type { Request } from 'express';

// ─── Constants ────────────────────────────────────────────────────────────────

const PDF_MIME_TYPE = 'application/pdf';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Storage ─────────────────────────────────────────────────────────────────

/**
 * Use memory storage for MVP — no files are persisted to disk.
 * For production, replace with R2/S3 storage.
 */
const storage = multer.memoryStorage();

// ─── File Filter ──────────────────────────────────────────────────────────────

const pdfFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const hasPdfMime = file.mimetype === PDF_MIME_TYPE;
  const hasPdfExt = file.originalname.toLowerCase().endsWith('.pdf');

  if (!hasPdfMime || !hasPdfExt) {
    return cb(
      new ApiError(
        httpStatus.BAD_REQUEST,
        'Invalid file type. Only PDF files are accepted.',
      ),
    );
  }

  cb(null, true);
};

// ─── Multer Instance ──────────────────────────────────────────────────────────

/**
 * Multer upload instance configured for PDF files.
 *
 * Usage in route:
 *   router.post('/import/pdf', auth(), uploadPdf.single('file'), controller)
 *
 * After multer runs, the file is available at req.file.buffer
 */
export const uploadPdf = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});
