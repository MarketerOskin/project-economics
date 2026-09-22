-- CreateTable
CREATE TABLE "CrmImportSource" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "entityTypeId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmImportSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmImportSource_portalId_idx" ON "CrmImportSource"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmImportSource_portalId_entityTypeId_key" ON "CrmImportSource"("portalId", "entityTypeId");

-- AddForeignKey
ALTER TABLE "CrmImportSource" ADD CONSTRAINT "CrmImportSource_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

