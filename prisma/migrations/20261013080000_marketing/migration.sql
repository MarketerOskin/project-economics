-- CreateEnum
CREATE TYPE "MarketingSpendKind" AS ENUM ('SPENT', 'PAID');

-- AlterEnum

ALTER TYPE "AuditEntityType" ADD VALUE 'MARKETING_SPEND';
ALTER TYPE "AuditEntityType" ADD VALUE 'MARKETING_PLAN';

-- CreateTable
CREATE TABLE "MarketingSpend" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "MarketingSpendKind" NOT NULL DEFAULT 'SPENT',
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "MarketingSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingPlan" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL DEFAULT '',
    "budget" DECIMAL(18,2),
    "leads" INTEGER,
    "qualifiedLeads" INTEGER,
    "sales" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "MarketingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConfig" (
    "portalId" TEXT NOT NULL,
    "qualifiedStages" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingConfig_pkey" PRIMARY KEY ("portalId")
);

-- CreateIndex
CREATE INDEX "MarketingSpend_portalId_date_idx" ON "MarketingSpend"("portalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingPlan_portalId_month_sourceId_key" ON "MarketingPlan"("portalId", "month", "sourceId");

-- AddForeignKey
ALTER TABLE "MarketingSpend" ADD CONSTRAINT "MarketingSpend_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingPlan" ADD CONSTRAINT "MarketingPlan_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingConfig" ADD CONSTRAINT "MarketingConfig_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

