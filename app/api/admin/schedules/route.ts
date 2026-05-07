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

type CreateSchedulePayload = {
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

export async function GET(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const weekStartDate = searchParams.get("weekStartDate");
  const scheduleWhere =
    weekStartDate && isIsoDate(weekStartDate)
      ? { weekStartDate: isoDateToDbDate(weekStartDate) }
      : {};

  const [doctors, schedules] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.DOCTOR },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.doctorSchedule.findMany({
      where: scheduleWhere,
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
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
    }),
  ]);

  return NextResponse.json({ doctors, schedules }, { status: 200 });
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.SYSTEM_ADMIN) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateSchedulePayload | null;
  if (!body) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  if (!Number.isInteger(body.doctorId) || (body.doctorId ?? 0) < 1) {
    return NextResponse.json({ message: "Выберите врача." }, { status: 400 });
  }
  if (!isIsoDate(body.weekStartDate)) {
    return NextResponse.json(
      { message: "Укажите неделю, для которой формируется расписание." },
      { status: 400 },
    );
  }
  const weekStartDateRaw = body.weekStartDate;
  const weekStartDate = isoDateToDbDate(weekStartDateRaw);

  if (!isWeekday(body.weekday)) {
    return NextResponse.json({ message: "Выберите день недели." }, { status: 400 });
  }

  const startTime = body.startTime?.trim();
  const endTime = body.endTime?.trim();
  if (!startTime || !endTime || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
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
    where: { id: body.doctorId },
    select: { id: true, role: true },
  });
  if (!doctor || doctor.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Врач не найден." }, { status: 404 });
  }

  const slotDateIso = getSlotDateIso(weekStartDateRaw, body.weekday);
  const todayIso = getTodayLocalIsoDate();
  if (slotDateIso < todayIso) {
    return NextResponse.json(
      { message: "Нельзя составлять расписание на прошедшие даты." },
      { status: 400 },
    );
  }
  if (slotDateIso === todayIso && startTime < getCurrentLocalTimeHHMM()) {
    return NextResponse.json(
      { message: "Для текущего дня нельзя указывать прошедшее время." },
      { status: 400 },
    );
  }

  const overlap = await prisma.doctorSchedule.findFirst({
    where: {
      doctorId: doctor.id,
      weekStartDate,
      weekday: body.weekday,
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

  try {
    const schedule = await prisma.doctorSchedule.create({
      data: {
        doctorId: doctor.id,
        weekStartDate,
        weekday: body.weekday,
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

    return NextResponse.json(
      { message: "Слот расписания добавлен.", schedule },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Такой слот уже существует." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Не удалось добавить слот расписания." },
      { status: 500 },
    );
  }
}
