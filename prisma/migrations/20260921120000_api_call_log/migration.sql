-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "request" TEXT,
    "response" TEXT,
    "ok" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCallLog_createdAt_idx" ON "ApiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_portalId_createdAt_idx" ON "ApiCallLog"("portalId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

