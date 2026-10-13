-- CreateTable
CREATE TABLE "CrmTimeField" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "entityTypeId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "hoursField" TEXT,
    "minutesField" TEXT,
    "userField" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTimeField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmTimeField_portalId_idx" ON "CrmTimeField"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTimeField_portalId_entityTypeId_key" ON "CrmTimeField"("portalId", "entityTypeId");

-- AddForeignKey
ALTER TABLE "CrmTimeField" ADD CONSTRAINT "CrmTimeField_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
