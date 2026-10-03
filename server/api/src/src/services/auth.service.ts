import crypto from "node:crypto";
import { logger } from "@/config/logger";
import { tokenTypes } from "@/config/tokens";

import { ApiError } from "@/utils";
import { comparePassword } from "@/utils/password-hash";
import httpStatus from "http-status";
import tokenService from "./token.service";
import userService from "./user.service";
import emailService from "./email.service";
import type { SafeUser } from "@/types";


const loginUserWithEmailAndPassword = async (
  email: string,
  password: string,
) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }
  return user;
};

const logout = async (refreshToken: string) => {
  await tokenService.getToken({
    token: refreshToken,
    type: tokenTypes.REFRESH,
    blacklisted: false,
  });

  await tokenService.deleteToken({
    token: refreshToken,
    type: tokenTypes.REFRESH,
    blacklisted: false,
  });
};

const refreshAuth = async (refreshToken: string) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(
      refreshToken,
      tokenTypes.REFRESH,
    );
    const user = await userService.getUserById(refreshTokenDoc.userId);
    await tokenService.deleteToken({ userId: refreshTokenDoc.userId });
    console.log(user)
    return tokenService.generateAuthTokens(user);
  } catch (error) {
    logger.error(error);
    throw new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate");
  }
};

const resetPassword = async (
  resetPasswordToken: string,
  newPassword: string,
) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(
      resetPasswordToken,
      tokenTypes.RESET_PASSWORD,
    );
    
    const user = await userService.getUserById(resetPasswordTokenDoc.userId);
    await userService.updateUserById(user.id, { password: newPassword });
    await tokenService.deleteToken({
      userId: user.id,
      type: tokenTypes.RESET_PASSWORD,
    });
    return user;
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Password reset failed");
  }
};

const verifyEmail = async (verifyEmailToken: string) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(
      verifyEmailToken,
      tokenTypes.VERIFY_EMAIL,
    );
    const user = await userService.getUserById(verifyEmailTokenDoc.userId);

    await tokenService.deleteToken({
      userId: user.id,
      type: tokenTypes.VERIFY_EMAIL,
    });
    await userService.updateUserById(user.id, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Email verification failed");
  }
};

const resendEmailVerification = async (token: string) => {
  try {
    const tokenDoc = await tokenService.verifyToken(token, tokenTypes.VERIFY_EMAIL);
    const user = await userService.getUserById(tokenDoc.userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
    await emailService.sendVerificationEmail(user.email, verifyEmailToken);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Email resend verification failed");
  }
};

const loginOrRegisterWithGoogle = async (googleData: {
  email: string;
  name?: string;
  avatarUrl?: string;
}) => {
  const existingUser = await userService.getUserByEmail(googleData.email);
  let safeUser: SafeUser;

  if (!existingUser) {
    // Generate secure random password for DB schema compatibility
    const randomPassword = crypto.randomUUID() + crypto.randomBytes(8).toString("hex");
    safeUser = await userService.createUser({
      name: googleData.name || googleData.email.split("@")[0],
      email: googleData.email,
      password: randomPassword,
      isEmailVerified: true,
      avatarUrl: googleData.avatarUrl,
    });
  } else {
    if (!existingUser.isEmailVerified || (googleData.avatarUrl && !existingUser.avatarUrl)) {
      safeUser = await userService.updateUserById(existingUser.id, {
        isEmailVerified: true,
        ...(googleData.avatarUrl && !existingUser.avatarUrl ? { avatarUrl: googleData.avatarUrl } : {}),
      });
    } else {
      const { password, ...rest } = existingUser;
      safeUser = rest;
    }
  }

  const tokens = await tokenService.generateAuthTokens(safeUser);
  return { user: safeUser, tokens };
};


export default {
  loginUserWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  loginOrRegisterWithGoogle,
};

