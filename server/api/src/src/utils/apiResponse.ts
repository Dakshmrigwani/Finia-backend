export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
  meta: Record<string, unknown> | null;
}

export class ApiResponse<T = unknown> implements IApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
  meta: Record<string, unknown> | null;

  constructor(
    success: boolean,
    message: string,
    data: T | null = null,
    error: string | null = null,
    meta: Record<string, unknown> | null = null,
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.meta = meta;
  }

  /** 2xx responses */
  static ok<T>(
    message: string,
    data: T,
    meta?: Record<string, unknown>,
  ): ApiResponse<T> {
    return new ApiResponse(true, message, data, null, meta ?? null);
  }

  /** Error responses */
  static fail(message: string, error?: string): ApiResponse<null> {
    return new ApiResponse(false, message, null, error ?? message, null);
  }
}