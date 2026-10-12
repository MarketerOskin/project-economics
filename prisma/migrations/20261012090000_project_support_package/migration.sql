-- Пакет поддержки проекта для раздела «Аналитика» (ADR-034)
ALTER TABLE "Project" ADD COLUMN "supportHoursLimit" DECIMAL(8,2);
ALTER TABLE "Project" ADD COLUMN "supportMonthlyFee" DECIMAL(18,2);
ALTER TABLE "Project" ADD COLUMN "supportHourRate" DECIMAL(18,2);
