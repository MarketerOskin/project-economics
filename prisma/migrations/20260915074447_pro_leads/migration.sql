-- CreateEnum
CREATE TYPE "ProLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DECLINED');

-- CreateTable
CREATE TABLE "ProLead" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "comment" TEXT,
    "status" "ProLeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledByOperator" TEXT,

    CONSTRAINT "ProLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProLead_portalId_idx" ON "ProLead"("portalId");

-- CreateIndex
CREATE INDEX "ProLead_status_idx" ON "ProLead"("status");

-- AddForeignKey
ALTER TABLE "ProLead" ADD CONSTRAINT "ProLead_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProLead" ADD CONSTRAINT "ProLead_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
