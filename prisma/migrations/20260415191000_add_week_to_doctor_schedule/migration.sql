-- Add week start date to doctor schedule
ALTER TABLE "DoctorSchedule"
ADD COLUMN "weekStartDate" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Replace unique index to include specific week
DROP INDEX "DoctorSchedule_doctorId_weekday_startTime_endTime_key";

CREATE UNIQUE INDEX "DoctorSchedule_doctorId_weekStartDate_weekday_startTime_endTime_key"
ON "DoctorSchedule"("doctorId", "weekStartDate", "weekday", "startTime", "endTime");
