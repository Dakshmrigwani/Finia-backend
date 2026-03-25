import { ApiError } from '@/utils';
import type { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Prisma } from '../generated/prisma/client';

export const prismaErrorHandler = (err: Error, _req: Request, _res: Response, next: NextFunction) => {
  const error = err;

  if (error instanceof Prisma.PrismaClientValidationError) {
    const apiError = new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid database query argument. Check your filters.',
      true,
      err.stack,
    );
    return next(apiError);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const apiError = new ApiError(
        httpStatus.BAD_REQUEST,
        'A record with this unique value already exists.',
        true,
        err.stack,
      );
      return next(apiError);
    }
  }

  next(error);
};
