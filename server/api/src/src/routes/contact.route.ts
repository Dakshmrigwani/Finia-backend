import contactController from '@/controllers/contact.controller';
import auth from '@/middlewares/auth';
import validate from '@/middlewares/validate';
import contactValidation from '@/validations/contact.validation';
import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /v1/contacts/sync:
 *   post:
 *     summary: Sync device contacts from Expo
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contacts]
 *             properties:
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     name:
 *                       type: string
 *                     phoneNumbers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     emails:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       200:
 *         description: Contacts synced successfully
 */
router.post(
  '/sync',
  auth(),
  validate(contactValidation.syncContacts),
  contactController.syncContacts,
);

/**
 * @swagger
 * /v1/contacts:
 *   get:
 *     summary: Get user's contacts with pagination and shared contact indicators
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated contact list
 */
router.get(
  '/',
  auth(),
  validate(contactValidation.getContacts),
  contactController.getContacts,
);

export default router;
