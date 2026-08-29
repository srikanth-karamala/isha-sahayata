-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentHubId" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "issueNotes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cycle_currentHubId_fkey" FOREIGN KEY ("currentHubId") REFERENCES "Hub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 20
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startHubId" TEXT NOT NULL,
    "endHubId" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_startHubId_fkey" FOREIGN KEY ("startHubId") REFERENCES "Hub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_endHubId_fkey" FOREIGN KEY ("endHubId") REFERENCES "Hub" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Cycle_qrCode_key" ON "Cycle"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_name_key" ON "Hub"("name");
