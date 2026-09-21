-- CreateEnum
CREATE TYPE "ShuttleKind" AS ENUM ('BUGGY', 'BULLOCK');

-- CreateTable
CREATE TABLE "ShuttleStop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleRoute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShuttleKind" NOT NULL DEFAULT 'BUGGY',
    "hours" TEXT,
    "hoursCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleRouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ShuttleRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleStop_name_key" ON "ShuttleStop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRoute_name_key" ON "ShuttleRoute"("name");

-- CreateIndex
CREATE INDEX "ShuttleRouteStop_stopId_idx" ON "ShuttleRouteStop"("stopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRouteStop_routeId_position_key" ON "ShuttleRouteStop"("routeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRouteStop_routeId_stopId_key" ON "ShuttleRouteStop"("routeId", "stopId");

-- AddForeignKey
ALTER TABLE "ShuttleRouteStop" ADD CONSTRAINT "ShuttleRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRouteStop" ADD CONSTRAINT "ShuttleRouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "ShuttleStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
