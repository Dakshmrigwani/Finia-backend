import authController from "@/controllers/auth.controller";
import auth from "@/middlewares/auth";
import validate from "@/middlewares/validate";
import authValidation from "@/validations/auth.validation";
import express from "express";

const router = express.Router();

/**
 * @swagger
 * /v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 */
router.post(
  "/register",
  validate(authValidation.register),
  authController.register,
);
/**
 * @swagger
/**
 * @swagger
 * /v1/auth/refresh-tokens:
 *   post:
 *     summary: Refresh access tokens
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 */
router.post(
  "/refresh-tokens",
  validate(authValidation.refreshTokens),
  authController.refreshTokens,
);

/**
 * @swagger
 * /v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  "/forgot-password",
  validate(authValidation.forgotPassword),
  authController.forgotPassword,
);

/**
 * @swagger
 * /v1/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post(
  "/reset-password",
  validate(authValidation.resetPassword),
  authController.resetPassword,
);

/**
 * @swagger
 * /v1/auth/send-verification-email:
 *   post:
 *     summary: Send verification email
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 */
router.post(
  "/send-verification-email",
  auth(),
  authController.sendVerificationEmail,
);

/**
 * @swagger
 * /v1/auth/verify-email:
 *   post:
 *     summary: Verify email with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.post(
  "/verify-email",
  validate(authValidation.verifyEmail),
  authController.verifyEmail,
);

/**
 * @swagger
 * /v1/auth/resend-verification-email:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification email resent
 */ 
router.post("/login", validate(authValidation.login), authController.login);

/**
 * @swagger
 * /v1/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", validate(authValidation.logout), authController.logout);


router.post(
  "/resend-verification-email",
  validate(authValidation.resendEmailVerification),
  authController.resendEmailVerification,
);

export default router;
