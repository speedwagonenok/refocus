-- AlterTable: unique email instead of fullName
ALTER TABLE "User" ADD COLUMN "email" TEXT;

UPDATE "User" SET "email" = 'migrated-' || "id"::text || '@local.invalid' WHERE "email" IS NULL;

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN "fullName";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
