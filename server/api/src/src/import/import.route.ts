import express from 'express';
import auth from '@/middlewares/auth';
import { uploadCsv } from './upload.middleware';
import { importCsvController } from './import.controller';

const router = express.Router();

/**
 * @swagger
 * /v1/transactions/import:
 *   post:
 *     summary: Import bank statement CSV
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Bank statement CSV file (max 5 MB, max 5000 rows)
 *               dateFormat:
 *                 type: string
 *                 enum: [DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD]
 *                 description: Optional expected date format
 *     responses:
 *       200:
 *         description: Import summary
 *       400:
 *         description: Empty file, no header, or zero valid rows
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Required columns could not be detected
 */
router.post(
  '/import',
  auth(),
  uploadCsv.single('file'),
  importCsvController,
);

export default router;
