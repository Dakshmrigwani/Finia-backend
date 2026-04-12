import httpStatus from 'http-status';

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true, // false = programmer error, not user fault
    stack?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(httpStatus.NOT_FOUND, message);
  }

  static badRequest(message: string) {
    return new ApiError(httpStatus.BAD_REQUEST, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(httpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(httpStatus.FORBIDDEN, message);
  }
}