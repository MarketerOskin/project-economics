-- How CRM stages count (ADR-051).
CREATE TYPE "StageOutcome" AS ENUM ('PROCESS', 'CLOSED', 'SUCCESS', 'CANCELLED');

CREATE TABLE "CrmStageRule" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "entityTypeId" INTEGER NOT NULL,
    "stageId" TEXT NOT NULL,
    "outcome" "StageOutcome" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmStageRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmStageRule_portalId_entityTypeId_stageId_key" ON "CrmStageRule"("portalId", "entityTypeId", "stageId");
CREATE INDEX "CrmStageRule_portalId_idx" ON "CrmStageRule"("portalId");

ALTER TABLE "CrmStageRule" ADD CONSTRAINT "CrmStageRule_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
