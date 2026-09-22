-- CreateEnum
CREATE TYPE "TimeDraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "hourlyRate" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "TaskTimeDraft" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "bitrixTaskIds" INTEGER[],
    "status" "TimeDraftStatus" NOT NULL DEFAULT 'PENDING',
    "resultingEntryId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTimeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskTimeDraft_resultingEntryId_key" ON "TaskTimeDraft"("resultingEntryId");

-- CreateIndex
CREATE INDEX "TaskTimeDraft_portalId_status_idx" ON "TaskTimeDraft"("portalId", "status");

-- CreateIndex
CREATE INDEX "TaskTimeDraft_projectId_idx" ON "TaskTimeDraft"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTimeDraft_portalId_projectId_employeeId_workDate_key" ON "TaskTimeDraft"("portalId", "projectId", "employeeId", "workDate");

-- AddForeignKey
ALTER TABLE "TaskTimeDraft" ADD CONSTRAINT "TaskTimeDraft_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeDraft" ADD CONSTRAINT "TaskTimeDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeDraft" ADD CONSTRAINT "TaskTimeDraft_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeDraft" ADD CONSTRAINT "TaskTimeDraft_resultingEntryId_fkey" FOREIGN KEY ("resultingEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeDraft" ADD CONSTRAINT "TaskTimeDraft_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

