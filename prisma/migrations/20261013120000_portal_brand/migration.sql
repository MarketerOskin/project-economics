-- CreateTable
CREATE TABLE "PortalBrand" (
    "portalId" TEXT NOT NULL,
    "companyName" TEXT,
    "requisites" TEXT,
    "contacts" TEXT,
    "accentColor" TEXT,
    "logo" BYTEA,
    "logoMime" TEXT,
    "signerName" TEXT,
    "signerTitle" TEXT,
    "footerNote" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalBrand_pkey" PRIMARY KEY ("portalId")
);

-- AddForeignKey
ALTER TABLE "PortalBrand" ADD CONSTRAINT "PortalBrand_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
