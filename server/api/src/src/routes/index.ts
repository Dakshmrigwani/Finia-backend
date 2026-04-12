import express from 'express';
import authRoute from './auth.route';
import budgetRoute from './budget.route';
import userRoute from './user.route';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/user',
    route: userRoute,
  },
  {
    path: '/budget',
    route: budgetRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
