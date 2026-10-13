-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('PRO', 'IMPLEMENTATION');

-- AlterTable
ALTER TABLE "ProLead" ADD COLUMN "kind" "LeadKind" NOT NULL DEFAULT 'PRO';
