import express from 'express';
import authRoute from './auth.route';
import budgetRoute from './budget.route';
import userRoute from './user.route';
import goalRoute from './goal.route';
import transactionRoute from './transaction.route';
import contactRoute from './contact.route';
import smsRoute from './sms.route';

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
  {
    path: '/goal',
    route: goalRoute,
  },
  {
    path: '/transaction',
    route: transactionRoute,
  },
  {
    path: '/contacts',
    route: contactRoute,
  },
  {
    path: '/sms',
    route: smsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
