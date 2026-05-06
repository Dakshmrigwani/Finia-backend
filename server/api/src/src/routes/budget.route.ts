import budgetController from "@/controllers/budget.controller";
import auth from "@/middlewares/auth";
import validate from "@/middlewares/validate";
import budgetValidation from "@/validations/budget.validation";
import express from "express";

const router = express.Router();

/**
 * @swagger
 * /v1/budget:
 *   post:
 *     summary: Create a new budget
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *               amount:
 *                 type: number
 *               period:
 *                 type: string
 *     responses:
 *       201:
 *         description: Budget created successfully
 *   get:
 *     summary: Get all budgets
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of budgets
 */
router
  .route("/")
  .post(
    auth(),
    validate(budgetValidation.createBudget),
    budgetController.createBudget,
  )
  .get(auth(), budgetController.getBudgets);

/**
 * @swagger
 * /v1/budget/{budgetId}:
 *   get:
 *     summary: Get budget by ID
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: budgetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget retrieved
 *   patch:
 *     summary: Update budget
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: budgetId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Budget updated successfully
 *   delete:
 *     summary: Delete budget
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: budgetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget deleted successfully
 */
router
  .route("/:budgetId")
  .get(auth(), validate(budgetValidation.getBudget), budgetController.getBudget)
  .patch(
    auth(),
    validate(budgetValidation.updateBudget),
    budgetController.updateBudget,
  )
  .delete(
    auth(),
    validate(budgetValidation.deleteBudget),
    budgetController.deleteBudget,
  );

/**
 * @swagger
 * /v1/budget/category/{category}:
 *   get:
 *     summary: Get budget by category
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget retrieved
 */
router
  .route("/category/:category")
  .get(
    auth(),
    validate(budgetValidation.getBudgetByCategory),
    budgetController.getBudgetByCategory,
  );

export default router;
