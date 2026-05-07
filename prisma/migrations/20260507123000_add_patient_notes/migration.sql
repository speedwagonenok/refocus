CREATE TABLE "PatientNote" (
  "id" SERIAL NOT NULL,
  "doctorId" INTEGER NOT NULL,
  "patientId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatientNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientNote_doctorId_patientId_createdAt_idx"
  ON "PatientNote"("doctorId", "patientId", "createdAt");

ALTER TABLE "PatientNote"
ADD CONSTRAINT "PatientNote_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientNote"
ADD CONSTRAINT "PatientNote_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
