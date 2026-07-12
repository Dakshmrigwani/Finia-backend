import goalController from "@/controllers/goal.controller";
import auth from "@/middlewares/auth";
import validate from "@/middlewares/validate";
import goalValidation from "@/validations/goal.validation";
import express from "express";

const router = express.Router();

/**
 * @swagger
 * /v1/goal:
 *   post:
 *     summary: Create a new goal
 *     tags: [Goal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goalName
 *               - targetAmount
 *             properties:
 *               goalName:
 *                 type: string
 *               goalType:
 *                 type: string
 *                 enum: [EMERGENCY_FUND, VACATION, CAR, HOME, GADGET, EDUCATION, INVESTMENT, CUSTOM]
 *               coverImage:
 *                 type: string
 *                 format: uri
 *               targetAmount:
 *                 type: number
 *               currentSavedAmount:
 *                 type: number
 *               targetDate:
 *                 type: string
 *                 format: date-time
 *               smartSaverEnabled:
 *                 type: boolean
 *               automationMinBalance:
 *                 type: number
 *               automationFrequency:
 *                 type: string
 *                 enum: [DAILY, WEEKLY, MONTHLY]
 *     responses:
 *       201:
 *         description: Goal created successfully
 *   get:
 *     summary: Get all user goals
 *     tags: [Goal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of goals
 */
router
  .route("/")
  .post(
    auth(),
    validate(goalValidation.createGoal),
    goalController.createGoal,
  )
  .get(auth(), goalController.getGoals);

/**
 * @swagger
 * /v1/goal/{goalId}:
 *   get:
 *     summary: Get goal by ID
 *     tags: [Goal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: goalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Goal retrieved
 *   patch:
 *     summary: Update goal by ID
 *     tags: [Goal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: goalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Goal updated successfully
 *   delete:
 *     summary: Delete goal by ID
 *     tags: [Goal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: goalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Goal deleted successfully
 */
router
  .route("/:goalId")
  .get(auth(), validate(goalValidation.getGoal), goalController.getGoal)
  .patch(
    auth(),
    validate(goalValidation.updateGoal),
    goalController.updateGoal,
  )
  .delete(
    auth(),
    validate(goalValidation.deleteGoal),
    goalController.deleteGoal,
  );

export default router;
