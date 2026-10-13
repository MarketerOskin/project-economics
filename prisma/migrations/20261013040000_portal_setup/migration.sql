-- CreateEnum
CREATE TYPE "CrmRole" AS ENUM ('TRAFFIC', 'SALES', 'SUPPORT', 'PROJECTS', 'IGNORE');

-- AlterTable
ALTER TABLE "PortalInstallation" ADD COLUMN "disabledSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CrmSectionRole" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "entityTypeId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "role" "CrmRole" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSectionRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmSectionRole_portalId_idx" ON "CrmSectionRole"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmSectionRole_portalId_entityTypeId_key" ON "CrmSectionRole"("portalId", "entityTypeId");

-- AddForeignKey
ALTER TABLE "CrmSectionRole" ADD CONSTRAINT "CrmSectionRole_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
