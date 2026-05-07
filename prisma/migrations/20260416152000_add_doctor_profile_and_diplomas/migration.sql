ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "doctorBio" TEXT,
ADD COLUMN "doctorSymptoms" JSONB;

CREATE TABLE "DoctorDiploma" (
  "id" SERIAL NOT NULL,
  "doctorId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "issuedBy" TEXT,
  "year" INTEGER,
  "imageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DoctorDiploma_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorDiploma_doctorId_idx" ON "DoctorDiploma"("doctorId");

ALTER TABLE "DoctorDiploma"
ADD CONSTRAINT "DoctorDiploma_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
