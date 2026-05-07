import { Prisma, Role, Weekday } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  CLINIC_CLOSE_TIME,
  CLINIC_OPEN_TIME,
  getCurrentLocalTimeHHMM,
  getSlotDateIso,
  getTodayLocalIsoDate,
  isSlotDurationValid,
  isWithinClinicHours,
} from "@/lib/scheduleTime";
import { getSessionUser } from "@/lib/sessionUser";

type UpdateSchedulePayload = {
  doctorId?: number;
  weekStartDate?: string;
  weekday?: Weekday;
  startTime?: string;
  endTime?: string;
};

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isWeekday(value: unknown): value is Weekday {
  return (
    value === Weekday.MONDAY ||
    value === Weekday.TUESDAY ||
    value === Weekday.WEDNESDAY ||
    value === Weekday.THURSDAY ||
    value === Weekday.FRIDAY ||
    value === Weekday.SATURDAY ||
    value === Weekday.SUNDAY
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDateToDbDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const scheduleId = Number(id);
  if (!Number.isInteger(scheduleId) || scheduleId < 1) {
    return NextResponse.json({ message: "Некорректный ID слота." }, { status: 400 });
  }

  const existing = await prisma.doctorSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      doctorId: true,
      weekStartDate: true,
      weekday: true,
      startTime: true,
      endTime: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "Слот не найден." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as UpdateSchedulePayload | null;
  if (!body) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  const doctorId = body.doctorId ?? existing.doctorId;
  const weekStartDateRaw =
    body.weekStartDate ?? existing.weekStartDate.toISOString().slice(0, 10);
  const weekday = body.weekday ?? existing.weekday;
  const startTime = (body.startTime ?? existing.startTime).trim();
  const endTime = (body.endTime ?? existing.endTime).trim();

  if (!Number.isInteger(doctorId) || doctorId < 1) {
    return NextResponse.json({ message: "Выберите врача." }, { status: 400 });
  }
  if (!isWeekday(weekday)) {
    return NextResponse.json({ message: "Выберите день недели." }, { status: 400 });
  }
  if (!isIsoDate(weekStartDateRaw)) {
    return NextResponse.json(
      { message: "Укажите корректную неделю (дата начала)." },
      { status: 400 },
    );
  }
  const weekStartDate = isoDateToDbDate(weekStartDateRaw);
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return NextResponse.json(
      { message: "Время должно быть в формате HH:MM." },
      { status: 400 },
    );
  }
  if (startTime >= endTime) {
    return NextResponse.json(
      { message: "Время начала должно быть раньше времени окончания." },
      { status: 400 },
    );
  }
  if (!isWithinClinicHours(startTime, endTime)) {
    return NextResponse.json(
      {
        message: `Слоты доступны только в рабочее время: ${CLINIC_OPEN_TIME} – ${CLINIC_CLOSE_TIME}.`,
      },
      { status: 400 },
    );
  }
  if (!isSlotDurationValid(startTime, endTime)) {
    return NextResponse.json(
      { message: "Максимальная длительность одного слота - 1 час." },
      { status: 400 },
    );
  }

  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: { id: true, role: true },
  });
  if (!doctor || doctor.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Врач не найден." }, { status: 404 });
  }

  const overlap = await prisma.doctorSchedule.findFirst({
    where: {
      id: { not: scheduleId },
      doctorId,
      weekStartDate,
      weekday,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
  });
  if (overlap) {
    return NextResponse.json(
      { message: "Слот пересекается с существующим расписанием врача." },
      { status: 409 },
    );
  }

  const slotDateIso = getSlotDateIso(weekStartDateRaw, weekday);
  const todayIso = getTodayLocalIsoDate();
  if (slotDateIso < todayIso) {
    return NextResponse.json(
      { message: "Нельзя изменять расписание на прошедшие даты." },
      { status: 400 },
    );
  }
  if (slotDateIso === todayIso && startTime < getCurrentLocalTimeHHMM()) {
    return NextResponse.json(
      { message: "Для текущего дня нельзя указывать прошедшее время." },
      { status: 400 },
    );
  }

  try {
    const schedule = await prisma.doctorSchedule.update({
      where: { id: scheduleId },
      data: {
        doctorId,
        weekStartDate,
        weekday,
        startTime,
        endTime,
      },
      select: {
        id: true,
        doctorId: true,
        weekStartDate: true,
        weekday: true,
        startTime: true,
        endTime: true,
        isActive: true,
        doctor: {
          select: {
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({ message: "Слот обновлен.", schedule }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ message: "Такой слот уже существует." }, { status: 409 });
    }
    return NextResponse.json(
      { message: "Не удалось обновить слот." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const scheduleId = Number(id);
  if (!Number.isInteger(scheduleId) || scheduleId < 1) {
    return NextResponse.json({ message: "Некорректный ID слота." }, { status: 400 });
  }

  const existing = await prisma.doctorSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, weekStartDate: true, weekday: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Слот не найден." }, { status: 404 });
  }

  const slotDateIso = getSlotDateIso(
    existing.weekStartDate.toISOString().slice(0, 10),
    existing.weekday,
  );
  if (slotDateIso < getTodayLocalIsoDate()) {
    return NextResponse.json(
      { message: "Нельзя изменять расписание на прошедшие даты." },
      { status: 400 },
    );
  }

  await prisma.doctorSchedule.delete({
    where: { id: scheduleId },
  });

  return NextResponse.json({ message: "Слот удален." }, { status: 200 });
}
