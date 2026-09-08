-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectSource" AS ENUM ('MANUAL', 'BITRIX_CRM');

-- CreateEnum
CREATE TYPE "CrmEntityType" AS ENUM ('DEAL', 'COMPANY', 'SMART_PROCESS');

-- CreateEnum
CREATE TYPE "FinanceDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('PLAN', 'FACT');

-- CreateEnum
CREATE TYPE "CalculationMode" AS ENUM ('FIXED', 'HOURS_RATE');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'PROJECT_RESTORED', 'FINANCE_CREATED', 'FINANCE_UPDATED', 'FINANCE_DELETED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_ARCHIVED', 'USER_ROLE_CHANGED', 'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_REMOVED');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('PROJECT', 'FINANCIAL_ENTRY', 'CATEGORY', 'USER', 'PROJECT_MEMBER');

-- CreateTable
CREATE TABLE "PortalInstallation" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "applicationToken" TEXT,
    "authTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "restEndpoint" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "bitrixUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBitrixAdmin" BOOLEAN NOT NULL DEFAULT false,
    "role" "AppRole" NOT NULL DEFAULT 'EMPLOYEE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clientName" TEXT,
    "internalComment" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "endDate" DATE,
    "sourceType" "ProjectSource" NOT NULL DEFAULT 'MANUAL',
    "crmEntityType" "CrmEntityType",
    "crmEntityTypeId" INTEGER,
    "crmEntityId" TEXT,
    "crmEntityTitle" TEXT,
    "crmEntityUrl" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT 'graphite',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "direction" "FinanceDirection" NOT NULL,
    "budgetType" "BudgetType" NOT NULL,
    "calculationMode" "CalculationMode" NOT NULL DEFAULT 'FIXED',
    "operationDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "hours" DECIMAL(10,2),
    "hourlyRate" DECIMAL(10,2),
    "employeeId" TEXT,
    "contractorName" TEXT,
    "counterpartyName" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATE,
    "documentUrl" TEXT,
    "description" TEXT,
    "comment" TEXT,
    "plannedEntryId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalInstallation_memberId_key" ON "PortalInstallation"("memberId");

-- CreateIndex
CREATE INDEX "AppUser_portalId_idx" ON "AppUser"("portalId");

-- CreateIndex
CREATE INDEX "AppUser_portalId_isActive_idx" ON "AppUser"("portalId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_portalId_bitrixUserId_key" ON "AppUser"("portalId", "bitrixUserId");

-- CreateIndex
CREATE INDEX "Project_portalId_idx" ON "Project"("portalId");

-- CreateIndex
CREATE INDEX "Project_portalId_status_idx" ON "Project"("portalId", "status");

-- CreateIndex
CREATE INDEX "Project_portalId_crmEntityTypeId_crmEntityId_idx" ON "Project"("portalId", "crmEntityTypeId", "crmEntityId");

-- CreateIndex
CREATE INDEX "ProjectMember_portalId_idx" ON "ProjectMember"("portalId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "FinanceCategory_portalId_idx" ON "FinanceCategory"("portalId");

-- CreateIndex
CREATE INDEX "FinanceCategory_portalId_kind_isArchived_idx" ON "FinanceCategory"("portalId", "kind", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_portalId_kind_name_key" ON "FinanceCategory"("portalId", "kind", "name");

-- CreateIndex
CREATE INDEX "FinancialEntry_portalId_idx" ON "FinancialEntry"("portalId");

-- CreateIndex
CREATE INDEX "FinancialEntry_projectId_idx" ON "FinancialEntry"("projectId");

-- CreateIndex
CREATE INDEX "FinancialEntry_categoryId_idx" ON "FinancialEntry"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialEntry_portalId_operationDate_idx" ON "FinancialEntry"("portalId", "operationDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_portalId_projectId_budgetType_direction_dele_idx" ON "FinancialEntry"("portalId", "projectId", "budgetType", "direction", "deletedAt");

-- CreateIndex
CREATE INDEX "FinancialEntry_portalId_deletedAt_idx" ON "FinancialEntry"("portalId", "deletedAt");

-- CreateIndex
CREATE INDEX "FinancialEntry_employeeId_idx" ON "FinancialEntry"("employeeId");

-- CreateIndex
CREATE INDEX "FinancialEntry_createdById_idx" ON "FinancialEntry"("createdById");

-- CreateIndex
CREATE INDEX "AuditLog_portalId_createdAt_idx" ON "AuditLog"("portalId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_portalId_entityType_entityId_idx" ON "AuditLog"("portalId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_portalId_projectId_idx" ON "AuditLog"("portalId", "projectId");

-- CreateIndex
CREATE INDEX "AuditLog_portalId_actorId_idx" ON "AuditLog"("portalId", "actorId");

-- CreateIndex
CREATE INDEX "AuditLog_portalId_action_idx" ON "AuditLog"("portalId", "action");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_plannedEntryId_fkey" FOREIGN KEY ("plannedEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
