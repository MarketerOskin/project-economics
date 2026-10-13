-- CreateTable
CREATE TABLE "SupportPosting" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "incomeAmount" DECIMAL(18,2) NOT NULL,
    "expenseAmount" DECIMAL(18,2) NOT NULL,
    "entryIds" TEXT[],
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById" TEXT,

    CONSTRAINT "SupportPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportPosting_portalId_projectId_month_key" ON "SupportPosting"("portalId", "projectId", "month");

-- AddForeignKey
ALTER TABLE "SupportPosting" ADD CONSTRAINT "SupportPosting_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPosting" ADD CONSTRAINT "SupportPosting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
