import { env } from '@/config';
import { tokenTypes } from '@/config/tokens';
import prisma from '@/lib/prisma';
import type { SafeUser, Token, TokenType } from '@/types';
import { ApiError } from '@/utils';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import userService from './user.service';

const generateToken = (userId: string, expires: moment.Moment, type: TokenType, secret = env.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

const saveToken = async (
  token: string,
  userId: string,
  expires: moment.Moment,
  type: TokenType,
  blacklisted = false,
) => {
  const tokenDoc = await prisma.token.create({
    data: {
      token,
      userId,
      expires: expires.toDate(),
      type,
      blacklisted,
    },
  });
  return tokenDoc;
};

const verifyToken = async (token: string, type: TokenType) => {
  const payload = jwt.verify(token, env.jwt.secret);
  const tokenDoc = await prisma.token.findFirst({
    where: {
      token,
      type,
      userId: (payload as { sub: string }).sub,
      blacklisted: false,
    },
  });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

const generateAuthTokens = async (user: SafeUser) => {
  const accessTokenExpires = moment().add(env.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = moment().add(env.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

const generateResetPasswordToken = async (email: string) => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
  }
  const expires = moment().add(env.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, user.id, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

const generateVerifyEmailToken = async (user: SafeUser) => {
  const expires = moment().add(env.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.id, expires, tokenTypes.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.id, expires, tokenTypes.VERIFY_EMAIL);
  return verifyEmailToken;
};

const getToken = async (where: Partial<Token>) => {
  const tokenDoc = await prisma.token.deleteMany({
    where,
  });

  if (!tokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Token not found');
  }

  return tokenDoc;
};

const deleteToken = async (where: Partial<Token>) => {
  const tokenDoc = await prisma.token.deleteMany({
    where,
  });

  return tokenDoc;
};

export default {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken,
  getToken,
  deleteToken,
};
