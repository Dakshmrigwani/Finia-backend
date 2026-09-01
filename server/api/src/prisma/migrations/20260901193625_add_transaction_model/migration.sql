-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('FIXED', 'RECURRING', 'VARIABLE', 'WEALTH_MOVEMENT');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('RENT', 'MORTGAGE', 'INSURANCE', 'SUBSCRIPTION', 'EMI', 'SALARY', 'UTILITIES', 'INTERNET', 'MOBILE_PLAN', 'GYM', 'STREAMING', 'SIP', 'FOOD', 'SHOPPING', 'ENTERTAINMENT', 'TRAVEL', 'HEALTHCARE', 'FUEL', 'TRANSFER', 'INVESTMENT', 'WITHDRAWAL', 'TOP_UP', 'DIVIDEND', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'NONE');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "recurrence" "RecurrenceFrequency" NOT NULL DEFAULT 'NONE',
    "date" TIMESTAMP(3) NOT NULL,
    "budget_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_direction_idx" ON "transactions"("direction");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
