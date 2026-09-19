-- CreateEnum
CREATE TYPE "FaultCategory" AS ENUM ('BRAKES', 'CHAIN', 'TYRE', 'FRAME', 'ELECTRICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FaultSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN     "faultCategory" "FaultCategory",
ADD COLUMN     "faultSeverity" "FaultSeverity",
ADD COLUMN     "faultSummary" TEXT,
ADD COLUMN     "safeToRide" BOOLEAN,
ADD COLUMN     "triagedAt" TIMESTAMP(3);
