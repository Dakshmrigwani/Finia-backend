import { ApiError } from '@/utils';
import { logger } from '@/config/logger';
import httpStatus from 'http-status';

// ─── PDF Text Extraction ───────────────────────────────────────────────────────

/**
 * Extracts plain text from a PDF buffer using pdf-parse.
 * Compatible with both pdf-parse v1 (function call) and v2 (PDFParse class).
 *
 * IMPORTANT: This function does NOT log any extracted text content.
 * Logging raw PDF text would expose financial and PII data.
 *
 * @param buffer - Raw PDF file buffer from multer memory storage
 * @returns Extracted plain text string
 * @throws ApiError(400) for corrupt, empty, or unreadable PDFs
 */
export const extractTextFromPdf = async (buffer: Buffer): Promise<string> => {
  if (!buffer || buffer.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'PDF file is empty.');
  }

  let text = '';
  let numpages = 1;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse');

    if (typeof pdfModule.PDFParse === 'function') {
      // pdf-parse v2+ API
      const uint8 = new Uint8Array(buffer);
      const parser = new pdfModule.PDFParse(uint8);
      const result = await parser.getText();
      text = typeof result === 'string' ? result : (result.text || '');
      numpages = result.total || result.pages?.length || 1;
    } else if (typeof pdfModule === 'function') {
      // pdf-parse v1 API
      const result = await pdfModule(buffer, { max: 100 });
      text = result.text || '';
      numpages = result.numpages || 1;
    } else if (typeof pdfModule.default === 'function') {
      const result = await pdfModule.default(buffer, { max: 100 });
      text = result.text || '';
      numpages = result.numpages || 1;
    } else {
      throw new Error('Unsupported pdf-parse module exports');
    }
  } catch (err) {
    logger.error('PDF parsing failed: %s', (err as Error).message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Failed to read the PDF. The file may be corrupt, encrypted, or in an unsupported format.',
    );
  }

  if (!text || text.trim().length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'The PDF appears to contain no extractable text. Only text-based PDFs are supported (not scanned image PDFs).',
    );
  }

  // Log metadata only — never log page content / text
  logger.info('PDF extracted: %d page(s), %d text chars', numpages, text.length);

  return text;
};
