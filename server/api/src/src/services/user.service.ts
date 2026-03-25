import prisma from '@/lib/prisma';
import type { CreateUserPayload, User as PrismaUser } from '@/types';
import type { PaginationFilters, PaginationOptions, SafeUser } from '@/types';
import { ApiError } from '@/utils';
import { comparePassword, hashPassword } from '@/utils/password-hash';
import httpStatus from 'http-status';

export const isEmailTaken = async (email: string, excludeUserId?: string): Promise<boolean> => {
  const user = await prisma.user.findFirst({
    where: {
      email,
      NOT: excludeUserId ? { id: excludeUserId } : undefined,
    },
  });

  return !!user;
};

const createUser = async (userBody: CreateUserPayload) => {
  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const passwordHash = await hashPassword(userBody.password);
  userBody.password = passwordHash;

  return prisma.user.create({
    data: userBody,
    omit: {
      password: true,
    },
  });
};

const queryUsers = async (options: PaginationOptions, filters: PaginationFilters) => {
  return prisma.user.paginate<SafeUser>({ options, filters, omit: ['password'] });
};

const getUserById = async (id: string, withPassword = false) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    omit: {
      password: withPassword,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

const getUserByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  return user;
};

interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

const updatePassword = async (userId: string, requestBody: UpdatePasswordPayload) => {
  const { oldPassword, newPassword } = requestBody;
  const user = await getUserById(userId, true);
  if (!(await comparePassword(oldPassword, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
  }
  const updatedUser = await updateUserById(userId, { password: newPassword });

  return updatedUser;
};

const updateUserById = async (userId: string, updateBody: Partial<PrismaUser>) => {
  await getUserById(userId);

  if (updateBody.email && (await isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateBody,
    omit: {
      password: true,
    },
  });

  return updatedUser;
};

const deleteUserById = async (userId: string) => {
  const user = await getUserById(userId);
  await prisma.user.delete({
    where: {
      id: userId,
    },
    omit: {
      password: true,
    },
  });

  return user;
};

export default {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updatePassword,
  updateUserById,
  deleteUserById,
};
