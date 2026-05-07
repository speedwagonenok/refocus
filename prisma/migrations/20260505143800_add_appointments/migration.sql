CREATE TABLE "Appointment" (
  "id" SERIAL NOT NULL,
  "doctorId" INTEGER NOT NULL,
  "patientId" INTEGER NOT NULL,
  "slotDate" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_doctorId_slotDate_idx" ON "Appointment"("doctorId", "slotDate");
CREATE INDEX "Appointment_patientId_slotDate_idx" ON "Appointment"("patientId", "slotDate");
CREATE UNIQUE INDEX "Appointment_doctorId_slotDate_startTime_endTime_key"
  ON "Appointment"("doctorId", "slotDate", "startTime", "endTime");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
