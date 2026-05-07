CREATE TYPE "PatientDocumentType" AS ENUM ('CONTRACT', 'PRESCRIPTION', 'VISIT_PROTOCOL');

CREATE TABLE "PatientDocument" (
  "id" SERIAL NOT NULL,
  "patientId" INTEGER NOT NULL,
  "managerId" INTEGER NOT NULL,
  "type" "PatientDocumentType" NOT NULL,
  "filePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientDocument_patientId_createdAt_idx" ON "PatientDocument"("patientId", "createdAt");
CREATE INDEX "PatientDocument_managerId_createdAt_idx" ON "PatientDocument"("managerId", "createdAt");

ALTER TABLE "PatientDocument"
ADD CONSTRAINT "PatientDocument_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientDocument"
ADD CONSTRAINT "PatientDocument_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
