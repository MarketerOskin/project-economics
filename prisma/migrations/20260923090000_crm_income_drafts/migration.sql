-- CreateTable
CREATE TABLE "CrmIncomeDraft" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crmAmount" DECIMAL(18,2) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TimeDraftStatus" NOT NULL DEFAULT 'PENDING',
    "resultingEntryId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmIncomeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmIncomeDraft_resultingEntryId_key" ON "CrmIncomeDraft"("resultingEntryId");

-- CreateIndex
CREATE INDEX "CrmIncomeDraft_portalId_status_idx" ON "CrmIncomeDraft"("portalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CrmIncomeDraft_portalId_projectId_key" ON "CrmIncomeDraft"("portalId", "projectId");

-- AddForeignKey
ALTER TABLE "CrmIncomeDraft" ADD CONSTRAINT "CrmIncomeDraft_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIncomeDraft" ADD CONSTRAINT "CrmIncomeDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIncomeDraft" ADD CONSTRAINT "CrmIncomeDraft_resultingEntryId_fkey" FOREIGN KEY ("resultingEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIncomeDraft" ADD CONSTRAINT "CrmIncomeDraft_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

