import smsController from '@/controllers/sms.controller';
import auth from '@/middlewares/auth';
import validate from '@/middlewares/validate';
import smsValidation from '@/validations/sms.validation';
import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /v1/sms/sync:
 *   post:
 *     summary: Filter and import financial transaction SMS from Expo
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [body]
 *                   properties:
 *                     id:
 *                       type: string
 *                     address:
 *                       type: string
 *                     body:
 *                       type: string
 *                     date:
 *                       type: number
 *     responses:
 *       200:
 *         description: Summary of parsed and imported transactions
 */
router.post(
  '/sync',
  auth(),
  validate(smsValidation.syncSms),
  smsController.syncSms,
);

export default router;
