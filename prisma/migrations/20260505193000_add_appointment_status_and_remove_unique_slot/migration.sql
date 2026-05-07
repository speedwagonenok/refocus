CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "Appointment"
  ADD COLUMN "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "Appointment"
SET "status" = CASE
  WHEN "isConfirmed" = TRUE THEN 'CONFIRMED'::"AppointmentStatus"
  ELSE 'PENDING'::"AppointmentStatus"
END;

DROP INDEX IF EXISTS "Appointment_doctorId_slotDate_startTime_endTime_key";
CREATE INDEX "Appointment_doctorId_slotDate_startTime_endTime_idx"
  ON "Appointment"("doctorId", "slotDate", "startTime", "endTime");

ALTER TABLE "Appointment"
  DROP COLUMN "isConfirmed";
