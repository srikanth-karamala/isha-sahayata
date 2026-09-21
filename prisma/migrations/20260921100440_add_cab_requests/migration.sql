-- CreateEnum
CREATE TYPE "CabScope" AS ENUM ('INSIDE', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "CabRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CabRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "pickup" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "whenAt" TIMESTAMP(3),
    "scope" "CabScope" NOT NULL DEFAULT 'INSIDE',
    "status" "CabRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CabRequest_status_createdAt_idx" ON "CabRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CabRequest" ADD CONSTRAINT "CabRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
