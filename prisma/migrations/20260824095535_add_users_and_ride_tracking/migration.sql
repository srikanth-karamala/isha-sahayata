-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "distanceMeters" REAL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentHubId" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "issueNotes" TEXT,
    "heldByUserId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cycle_currentHubId_fkey" FOREIGN KEY ("currentHubId") REFERENCES "Hub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cycle_heldByUserId_fkey" FOREIGN KEY ("heldByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cycle" ("currentHubId", "id", "issueNotes", "latitude", "longitude", "qrCode", "status", "updatedAt") SELECT "currentHubId", "id", "issueNotes", "latitude", "longitude", "qrCode", "status", "updatedAt" FROM "Cycle";
DROP TABLE "Cycle";
ALTER TABLE "new_Cycle" RENAME TO "Cycle";
CREATE UNIQUE INDEX "Cycle_qrCode_key" ON "Cycle"("qrCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
