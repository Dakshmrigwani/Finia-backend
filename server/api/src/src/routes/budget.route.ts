import budgetController from '@/controllers/budget.controller';
import auth from '@/middlewares/auth';
import validate from '@/middlewares/validate';
import budgetValidation from '@/validations/budget.validation';
import express from 'express';

const router = express.Router();

router
  .route('/')
  .post(auth(), validate(budgetValidation.createBudget), budgetController.createBudget)
  .get(auth(), budgetController.getBudgets);

router
  .route('/:budgetId')
  .get(auth(), validate(budgetValidation.getBudget), budgetController.getBudget)
  .patch(auth(), validate(budgetValidation.updateBudget), budgetController.updateBudget)
  .delete(auth(), validate(budgetValidation.deleteBudget), budgetController.deleteBudget);

router
  .route('/category/:category')
  .get(auth(), validate(budgetValidation.getBudgetByCategory), budgetController.getBudgetByCategory);

export default router;
