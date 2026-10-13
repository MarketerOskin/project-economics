-- Project directions: support, implementation, development… (ADR-052).
-- CreateEnum
CREATE TYPE "StreamKind" AS ENUM ('SUPPORT', 'IMPLEMENTATION', 'DEVELOPMENT', 'CONSULTING', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'PROJECT_STREAM';

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "streamId" TEXT;

-- CreateTable
CREATE TABLE "ProjectStream" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "StreamKind" NOT NULL,
    "name" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "endDate" DATE,
    "budget" DECIMAL(18,2),
    "monthlyFee" DECIMAL(18,2),
    "hourRate" DECIMAL(18,2),
    "hoursLimit" DECIMAL(8,2),
    "memberIds" TEXT[],
    "comment" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStream_portalId_idx" ON "ProjectStream"("portalId");

-- CreateIndex
CREATE INDEX "ProjectStream_portalId_projectId_idx" ON "ProjectStream"("portalId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectStream_portalId_kind_idx" ON "ProjectStream"("portalId", "kind");

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "ProjectStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStream" ADD CONSTRAINT "ProjectStream_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStream" ADD CONSTRAINT "ProjectStream_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

