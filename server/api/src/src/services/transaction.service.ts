import prisma from "@/lib/prisma";
import type {
  TransactionType,
  TransactionDirection,
  TransactionCategory,
  RecurrenceFrequency,
} from "@/types";
import { ApiError } from "@/utils";
import type { PaginationOptions } from "@/types";
import httpStatus from "http-status";

export interface CreateTransactionBody {
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  direction: TransactionDirection;
  category: TransactionCategory;
  recurrence?: RecurrenceFrequency;
  date: string | Date;
  budgetId?: string;
  note?: string;
}

export interface UpdateTransactionBody {
  title?: string;
  description?: string;
  amount?: number;
  type?: TransactionType;
  direction?: TransactionDirection;
  category?: TransactionCategory;
  recurrence?: RecurrenceFrequency;
  date?: string | Date;
  budgetId?: string | null;
  note?: string;
}

export interface GetTransactionsQuery extends PaginationOptions {
  search?: string;
  date?: string;
  month?: string | number;
  year?: string | number;
  dateFrom?: string;
  dateTo?: string;
  type?: TransactionType;
  direction?: TransactionDirection;
  category?: TransactionCategory;
  budgetId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertExists = async (transactionId: string, userId: string) => {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!tx) throw new ApiError(httpStatus.NOT_FOUND, "Transaction not found");
  if (tx.userId !== userId)
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You do not have permission to access this transaction",
    );
  return tx;
};

// ─── Service Functions ────────────────────────────────────────────────────────

const createTransaction = async (
  userId: string,
  body: CreateTransactionBody,
) => {
  if (body.budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: body.budgetId },
    });
    if (!budget || budget.userId !== userId)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid budgetId — budget not found or does not belong to you",
      );
  }

  return prisma.transaction.create({
    data: {
      userId,
      title: body.title,
      description: body.description,
      amount: body.amount,
      type: body.type,
      direction: body.direction,
      category: body.category,
      recurrence: body.recurrence ?? "NONE",
      date: new Date(body.date),
      budgetId: body.budgetId ?? null,
      note: body.note,
    },
    include: { budget: { select: { id: true, category: true } } },
  });
};

const getTransactions = async (userId: string, query: GetTransactionsQuery) => {
  const {
    search,
    date,
    month,
    year,
    dateFrom,
    dateTo,
    type,
    direction,
    category,
    budgetId,
    page,
    limit,
    sortBy,
  } = query;

  const where: Record<string, any> = { userId };

  // Enum filters
  if (type) where.type = type;
  if (direction) where.direction = direction;
  if (category) where.category = category;
  if (budgetId) where.budgetId = budgetId;

  // Date filters — priority: exact date > date range > month/year
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  } else if (dateFrom || dateTo) {
    const rangeFilter: Record<string, Date> = {};
    if (dateFrom) {
      const f = new Date(dateFrom);
      f.setHours(0, 0, 0, 0);
      rangeFilter.gte = f;
    }
    if (dateTo) {
      const t = new Date(dateTo);
      t.setHours(23, 59, 59, 999);
      rangeFilter.lte = t;
    }
    where.date = rangeFilter;
  } else if (month || year) {
    const y = year ? Number(year) : new Date().getFullYear();
    if (month) {
      const m = Number(month);
      where.date = {
        gte: new Date(y, m - 1, 1, 0, 0, 0, 0),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    } else {
      where.date = {
        gte: new Date(y, 0, 1, 0, 0, 0, 0),
        lte: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }
  }

  // Search — title OR description
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: "insensitive" } },
      { description: { contains: search.trim(), mode: "insensitive" } },
      { note: { contains: search.trim(), mode: "insensitive" } },
      { amount: { equals: Number(search.trim()) } },
    ];
  }

  // Sorting
  let orderBy: Record<string, "asc" | "desc">[] = [{ date: "desc" }];
  if (sortBy) {
    orderBy = sortBy.split(",").map((s) => {
      const [key, order] = s.split(":");
      return { [key]: order === "asc" ? "asc" : ("desc" as const) };
    });
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [results, totalRecords] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { budget: { select: { id: true, category: true } } },
      orderBy,
      take: limitNum,
      skip,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    results,
    page: pageNum,
    limit: limitNum,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limitNum),
  };
};

const getTransactionById = async (transactionId: string, userId: string) => {
  const tx = await assertExists(transactionId, userId);
  return prisma.transaction.findUnique({
    where: { id: tx.id },
    include: { budget: { select: { id: true, category: true } } },
  });
};

const updateTransaction = async (
  transactionId: string,
  userId: string,
  body: UpdateTransactionBody,
) => {
  await assertExists(transactionId, userId);

  if (body.budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: body.budgetId },
    });
    if (!budget || budget.userId !== userId)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid budgetId — budget not found or does not belong to you",
      );
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
    },
    include: { budget: { select: { id: true, category: true } } },
  });
};

const deleteTransaction = async (transactionId: string, userId: string) => {
  await assertExists(transactionId, userId);
  return prisma.transaction.delete({ where: { id: transactionId } });
};

export default {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
