import userService from '@/services/user.service';
import type { AuthedReq } from '@/types';
import type { GetUsersQuery, UpdateProfileBody } from '@/types/validation.types';
import { pick, ApiResponse, asyncWrapper, sendResponse } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const createUser: RequestHandler = asyncWrapper(async (req, res) => {
  const user = await userService.createUser(req.body);
  const payload = ApiResponse.ok("User created successfully", user);
  sendResponse(res, httpStatus.CREATED, payload);
});

const getUsers: RequestHandler = asyncWrapper(async (req, res) => {
  const query = req.query as GetUsersQuery;
  const options = pick(query, ['page', 'limit', 'sortBy']);
  const filter = pick(query, ['name', 'role']);

  const result = await userService.queryUsers(options, filter);
  const { results, ...meta } = result;
  const payload = ApiResponse.ok("Users retrieved successfully", results, meta);
  sendResponse(res, httpStatus.OK, payload);
});

const getUserProfile: RequestHandler = asyncWrapper(async (req, res) => {
  const { id } = (req as AuthedReq).user;
  const user = await userService.getUserById(id);
  const payload = ApiResponse.ok("User profile retrieved successfully", user);
  sendResponse(res, httpStatus.OK, payload);
});

const updateUserProfile: RequestHandler = asyncWrapper(async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const { newPassword, oldPassword, ...rest } = req.body as UpdateProfileBody;

  const updatedUser =
    newPassword && oldPassword
      ? await userService.updatePassword(userId, {
          newPassword,
          oldPassword,
        })
      : await userService.updateUserById(userId, rest);

  const payload = ApiResponse.ok("User profile updated successfully", updatedUser);
  sendResponse(res, httpStatus.OK, payload);
});

const getUser: RequestHandler = asyncWrapper(async (req, res) => {
  const userId = req.params.userId as string;
  const user = await userService.getUserById(userId);
  const payload = ApiResponse.ok("User retrieved successfully", user);
  sendResponse(res, httpStatus.OK, payload);
});

const updateUser: RequestHandler = asyncWrapper(async (req, res) => {
  const userId = req.params.userId as string;
  const user = await userService.updateUserById(userId, req.body);
  const payload = ApiResponse.ok("User updated successfully", user);
  sendResponse(res, httpStatus.OK, payload);
});

const deleteUser: RequestHandler = asyncWrapper(async (req, res) => {
  const userId = req.params.userId as string;
  await userService.deleteUserById(userId);
  const payload = ApiResponse.ok("User deleted successfully", null);
  sendResponse(res, httpStatus.OK, payload);
});

export default {
  createUser,
  getUsers,
  getUserProfile,
  updateUserProfile,
  getUser,
  updateUser,
  deleteUser,
};
