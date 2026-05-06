import userController from "@/controllers/user.controller";
import auth from "@/middlewares/auth";
import validate from "@/middlewares/validate";
import userValidation from "@/validations/user.validation";
import express from "express";

const router = express.Router();

/**
 * @swagger
 * /v1/user:
 *   post:
 *     summary: Create a new user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *   get:
 *     summary: Get all users
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router
  .route("/")
  .post(
    auth(["ADMIN"]),
    validate(userValidation.createUser),
    userController.createUser,
  )
  .get(
    auth(["ADMIN"]),
    validate(userValidation.getUsers),
    userController.getUsers,
  );

/**
 * @swagger
 * /v1/user/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *   patch:
 *     summary: Update user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router
  .route("/profile")
  .get(auth(), userController.getUserProfile)
  .patch(
    auth(),
    validate(userValidation.updateProfile),
    userController.updateUserProfile,
  );

/**
 * @swagger
 * /v1/user/{userId}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User retrieved
 *   patch:
 *     summary: Update user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *   delete:
 *     summary: Delete user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 */
router
  .route("/:userId")
  .get(
    auth(["ADMIN"]),
    validate(userValidation.getUser),
    userController.getUser,
  )
  .patch(
    auth(["ADMIN"]),
    validate(userValidation.updateUser),
    userController.updateUser,
  )
  .delete(
    auth(["ADMIN"]),
    validate(userValidation.deleteUser),
    userController.deleteUser,
  );

export default router;
