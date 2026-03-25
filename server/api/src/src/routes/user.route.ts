import userController from '@/controllers/user.controller';
import auth from '@/middlewares/auth';
import validate from '@/middlewares/validate';
import userValidation from '@/validations/user.validation';
import express from 'express';

const router = express.Router();

router
  .route('/')
  .post(auth(['ADMIN']), validate(userValidation.createUser), userController.createUser)
  .get(auth(['ADMIN']), validate(userValidation.getUsers), userController.getUsers);

router
  .route('/profile')
  .get(auth(), userController.getUserProfile)
  .patch(auth(), validate(userValidation.updateProfile), userController.updateUserProfile);

router
  .route('/:userId')
  .get(auth(['ADMIN']), validate(userValidation.getUser), userController.getUser)
  .patch(auth(['ADMIN']), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth(['ADMIN']), validate(userValidation.deleteUser), userController.deleteUser);

export default router;
