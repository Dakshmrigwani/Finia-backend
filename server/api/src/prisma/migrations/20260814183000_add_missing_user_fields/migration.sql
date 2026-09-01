-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiNudges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "avatarUrl" VARCHAR(500),
ADD COLUMN     "biometric" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "currency" VARCHAR(50) DEFAULT 'USD ($)',
ADD COLUMN     "maritalStatus" VARCHAR(255),
ADD COLUMN     "notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "spendMostlyOn" VARCHAR(255),
ADD COLUMN     "theme" VARCHAR(50) DEFAULT 'dark',
ADD COLUMN     "twoFactor" BOOLEAN NOT NULL DEFAULT false;
