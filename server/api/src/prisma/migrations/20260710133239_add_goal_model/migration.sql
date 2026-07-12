-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('EMERGENCY_FUND', 'VACATION', 'CAR', 'HOME', 'GADGET', 'EDUCATION', 'INVESTMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AutomationFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "GoalCreatedVia" AS ENUM ('MANUAL', 'AI_PLAN');

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalName" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL DEFAULT 'CUSTOM',
    "coverImage" TEXT,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "currentSavedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "projectedCompletionDate" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "smartSaverEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automationMinBalance" DECIMAL(12,2),
    "automationFrequency" "AutomationFrequency",
    "createdVia" "GoalCreatedVia" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
