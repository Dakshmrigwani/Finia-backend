import userService from '@/services/user.service';
import type { AuthedReq } from '@/types';
import type { GetUsersQuery, UpdateProfileBody } from '@/types/validation.types';
import { pick } from '@/utils';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status';

const createUser: RequestHandler = async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send(user);
};

const getUsers: RequestHandler = async (req, res) => {
  const query = req.query as GetUsersQuery;
  const options = pick(query, ['page', 'limit', 'sortBy']);
  const filter = pick(query, ['name', 'role']);

  const result = await userService.queryUsers(options, filter);
  res.send(result);
};

const getUserProfile: RequestHandler = async (req, res) => {
  const { id } = (req as AuthedReq).user;
  const user = await userService.getUserById(id);
  res.status(httpStatus.OK).send(user);
};

const updateUserProfile: RequestHandler = async (req, res) => {
  const { id: userId } = (req as AuthedReq).user;
  const { newPassword, oldPassword, ...rest } = req.body as UpdateProfileBody;

  const updatedUser =
    newPassword && oldPassword
      ? await userService.updatePassword(userId, {
          newPassword,
          oldPassword,
        })
      : await userService.updateUserById(userId, rest);

  res.send(updatedUser);
};

const getUser: RequestHandler = async (req, res) => {
  const user = await userService.getUserById(req.params.userId);
  res.send(user);
};

const updateUser: RequestHandler = async (req, res) => {
  const user = await userService.updateUserById(req.params.userId, req.body);
  res.send(user);
};

const deleteUser: RequestHandler = async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
};

export default {
  createUser,
  getUsers,
  getUserProfile,
  updateUserProfile,
  getUser,
  updateUser,
  deleteUser,
};
