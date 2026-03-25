import { authService, emailService, tokenService, userService } from '@/services';
import type { AuthedReq } from '@/types';
import type { LoginBody, RegisterBody } from '@/types/validation.types';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const register: RequestHandler = async (req, res) => {
  const user = await userService.createUser(req.body as RegisterBody);
  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.CREATED).send({ user, tokens });
};

const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginBody;
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
};

const logout: RequestHandler = async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.OK).send({ success: true, message: 'User logout successfully!' });
};

const forgotPassword: RequestHandler = async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
};

const refreshTokens: RequestHandler = async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
};

const resetPassword: RequestHandler = async (req, res) => {
  const updatedUser = await authService.resetPassword(req.query.token as string, req.body.password);
  await emailService.sendPasswordRestSuccessEmail(updatedUser.email);
  res.status(httpStatus.NO_CONTENT).send();
};

const sendVerificationEmail: RequestHandler = async (req, res) => {
  const user = (req as AuthedReq).user;
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
};

const verifyEmail: RequestHandler = async (req, res) => {
  await authService.verifyEmail(req.query.token as string);
  res.status(httpStatus.NO_CONTENT).send();
};

export default {
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  register,
};
