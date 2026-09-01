import transactionController from '@/controllers/transaction.controller';
import auth from '@/middlewares/auth';
import validate from '@/middlewares/validate';
import transactionValidation from '@/validations/transaction.validation';
import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /v1/transaction:
 *   post:
 *     summary: Create a new transaction
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, amount, type, direction, category, date]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [FIXED, RECURRING, VARIABLE, WEALTH_MOVEMENT]
 *               direction:
 *                 type: string
 *                 enum: [INCOME, EXPENSE, TRANSFER]
 *               category:
 *                 type: string
 *               recurrence:
 *                 type: string
 *                 enum: [DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, NONE]
 *               date:
 *                 type: string
 *                 format: date
 *               budgetId:
 *                 type: string
 *                 format: uuid
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *   get:
 *     summary: Get paginated list of transactions with filters
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *         description: "e.g. date:desc,amount:asc"
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search title and description
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Exact date (YYYY-MM-DD)
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [FIXED, RECURRING, VARIABLE, WEALTH_MOVEMENT] }
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [INCOME, EXPENSE, TRANSFER] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: budgetId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated list of transactions
 */
router
  .route('/')
  .post(auth(), validate(transactionValidation.createTransaction), transactionController.createTransaction)
  .get(auth(), validate(transactionValidation.getTransactions), transactionController.getTransactions);

/**
 * @swagger
 * /v1/transaction/{transactionId}:
 *   get:
 *     summary: Get a transaction by ID
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction retrieved successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Transaction not found
 *   patch:
 *     summary: Update a transaction
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *   delete:
 *     summary: Delete a transaction
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction deleted successfully
 */
router
  .route('/:transactionId')
  .get(auth(), validate(transactionValidation.getTransaction), transactionController.getTransaction)
  .patch(auth(), validate(transactionValidation.updateTransaction), transactionController.updateTransaction)
  .delete(auth(), validate(transactionValidation.deleteTransaction), transactionController.deleteTransaction);

export default router;
