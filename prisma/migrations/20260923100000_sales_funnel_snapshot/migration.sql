-- CreateEnum
CREATE TYPE "DealSemantic" AS ENUM ('IN_PROGRESS', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "SalesFunnelSnapshot" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "categoryName" TEXT NOT NULL,
    "semantic" "DealSemantic" NOT NULL,
    "dealCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesFunnelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesFunnelSnapshot_portalId_idx" ON "SalesFunnelSnapshot"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesFunnelSnapshot_portalId_categoryId_semantic_key" ON "SalesFunnelSnapshot"("portalId", "categoryId", "semantic");

-- AddForeignKey
ALTER TABLE "SalesFunnelSnapshot" ADD CONSTRAINT "SalesFunnelSnapshot_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

