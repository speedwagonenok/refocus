ALTER TABLE "PatientNote"
  ALTER COLUMN "content" DROP NOT NULL;

ALTER TABLE "PatientNote"
  ADD COLUMN "filePath" TEXT,
  ADD COLUMN "fileName" TEXT;
