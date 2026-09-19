-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Upload_folder_createdAt_idx" ON "Upload"("folder", "createdAt");
