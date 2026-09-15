-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "PortalInstallation" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "planNote" TEXT;

-- CreateTable
CREATE TABLE "OperatorGrant" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorGrant_portalId_idx" ON "OperatorGrant"("portalId");

-- AddForeignKey
ALTER TABLE "OperatorGrant" ADD CONSTRAINT "OperatorGrant_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
