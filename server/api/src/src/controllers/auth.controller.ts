import {
  authService,
  emailService,
  tokenService,
  userService,
} from "@/services";
import type { AuthedReq } from "@/types";
import type { LoginBody, RegisterBody } from "@/types/validation.types";
import type { RequestHandler } from "express";
import httpStatus from "http-status";
import {VERIFICATION_EMAIL} from "@/utils/email-templates";
import { ApiError, ApiResponse, asyncWrapper, sendResponse } from "@/utils";

const register: RequestHandler = asyncWrapper(async (req, res) => {
  const user = await userService.createUser(req.body as RegisterBody);
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Failed to create user");
  }
  const tokens = await tokenService.generateAuthTokens(user);

  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  if (!verifyEmailToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Failed to create token");
  }

  await emailService.sendVerificationEmail(user.email, verifyEmailToken);
  const payload = ApiResponse.ok("User registered successfully. Verification email sent.", { user, tokens });
  sendResponse(res, httpStatus.CREATED, payload);
});

const login: RequestHandler = asyncWrapper(async (req, res) => {
  const { email, password } = req.body as LoginBody;
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  const payload = ApiResponse.ok("Login successful", { user, tokens });
  sendResponse(res, httpStatus.OK, payload);
});

const logout: RequestHandler = asyncWrapper(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  const payload = ApiResponse.ok("User logout successfully", null);
  sendResponse(res, httpStatus.OK, payload);
});

const forgotPassword: RequestHandler = asyncWrapper(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(
    req.body.email,
  );
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  const payload = ApiResponse.ok("Password reset email sent", null);
  sendResponse(res, httpStatus.OK, payload);
});

const refreshTokens: RequestHandler = asyncWrapper(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  const payload = ApiResponse.ok("Tokens refreshed successfully", tokens);
  sendResponse(res, httpStatus.OK, payload);
});

const resetPassword: RequestHandler = asyncWrapper(async (req, res) => {
  const updatedUser = await authService.resetPassword(
    req.query.token as string,
    req.body.password,
  );
  await emailService.sendPasswordRestSuccessEmail(updatedUser.email);
  const payload = ApiResponse.ok("Password reset successfully", null);
  sendResponse(res, httpStatus.OK, payload);
});

const sendVerificationEmail: RequestHandler = asyncWrapper(async (req, res) => {
  const user = (req as AuthedReq).user;
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);
  const payload = ApiResponse.ok("Verification email sent", null);
  sendResponse(res, httpStatus.OK, payload);
});

const verifyEmail: RequestHandler = asyncWrapper(async (req, res) => {
  await authService.verifyEmail(req.query.token as string);
  const payload = ApiResponse.ok("Email verified successfully", null);
  sendResponse(res, httpStatus.OK, payload);
});

const resendEmailVerification: RequestHandler = asyncWrapper(async (req, res) => {
  await authService.resendEmailVerification(req.body.token);
  const payload = ApiResponse.ok("Verification email resent", null);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  register,
  resendEmailVerification,
};
