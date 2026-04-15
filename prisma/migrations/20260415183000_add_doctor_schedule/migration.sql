-- CreateEnum
CREATE TYPE "Weekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
  "id" SERIAL NOT NULL,
  "doctorId" INTEGER NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctorId_weekday_startTime_endTime_key"
ON "DoctorSchedule"("doctorId", "weekday", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "DoctorSchedule"
ADD CONSTRAINT "DoctorSchedule_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
