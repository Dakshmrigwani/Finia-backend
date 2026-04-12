import type { Request } from "express";
import type { JwtPayload as BaseJwtPayload } from "jsonwebtoken";
import { Token, TokenType, User, UserRole, Budget } from "../generated/prisma/client";

// Central export to prisma-client types
export { User, Token, TokenType, UserRole, Budget };

export type SafeUser = Omit<User, "password">;


export interface PaginationOptions {
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  include?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type PaginationFilters = Record<string, string | any>;

export interface PaginateResult<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

export interface AppJwtPayload extends BaseJwtPayload {
  sub: string;
  type: string;
}

export interface AuthedReq extends Request {
  user: SafeUser;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}


// end user and token related types



// start budget related types

export interface CreateBudgetPayload {
  amount: number;
  limit: number;
  category: string;
  startDate: Date;
  endDate: Date;
}
