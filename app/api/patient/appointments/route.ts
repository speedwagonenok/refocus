import { AppointmentStatus, Prisma, Role, Weekday } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAppointmentPast } from "@/lib/appointments";
import { normalizeRuPhone } from "@/lib/authValidation";
import { parseDoctorMatchMeta } from "@/lib/doctorSymptomsJson";
import { prisma } from "@/lib/prisma";
import { getCurrentLocalTimeHHMM, getTodayLocalIsoDate } from "@/lib/scheduleTime";
import { getSessionUser } from "@/lib/sessionUser";

type CreateAppointmentPayload = {
  doctorId?: number;
  slotDate?: string;
  startTime?: string;
  endTime?: string;
  contactPhone?: string;
};

const weekdayByIndex: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function toUtcDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function getMondayIsoAndWeekday(slotDateIso: string): { weekStartIso: string; weekday: Weekday } | null {
  const date = parseIsoDate(slotDateIso);
  if (!date) {
    return null;
  }
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + mondayOffset);
  const weekdayIndex = day === 0 ? 6 : day - 1;
  const weekday = weekdayByIndex[weekdayIndex];
  if (!weekday) {
    return null;
  }
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return { weekStartIso: `${y}-${m}-${d}`, weekday };
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateAppointmentPayload | null;
  if (
    !body ||
    !Number.isInteger(body.doctorId) ||
    !body.slotDate ||
    !body.startTime ||
    !body.endTime ||
    !body.contactPhone
  ) {
    return NextResponse.json({ message: "Заполните данные для записи." }, { status: 400 });
  }

  const doctorId = Number(body.doctorId);
  if (doctorId < 1) {
    return NextResponse.json({ message: "Некорректный врач." }, { status: 400 });
  }

  const slotDate = body.slotDate.trim();
  const startTime = body.startTime.trim();
  const endTime = body.endTime.trim();
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return NextResponse.json({ message: "Некорректное время слота." }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ message: "Время начала должно быть раньше времени конца." }, { status: 400 });
  }

  const rawContactPhone = body.contactPhone.trim();
  const normalizedPhone = normalizeRuPhone(rawContactPhone);
  if (!normalizedPhone) {
    return NextResponse.json(
      { message: "Введите корректный российский номер (например +7 999 123-45-67)." },
      { status: 400 },
    );
  }

  const todayIso = getTodayLocalIsoDate();
  if (slotDate < todayIso || (slotDate === todayIso && startTime <= getCurrentLocalTimeHHMM())) {
    return NextResponse.json({ message: "Нельзя записаться на прошедшее время." }, { status: 400 });
  }

  const slotPosition = getMondayIsoAndWeekday(slotDate);
  if (!slotPosition) {
    return NextResponse.json({ message: "Некорректная дата слота." }, { status: 400 });
  }

  const [doctor, scheduleSlot] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId, role: Role.DOCTOR },
      select: { id: true },
    }),
    prisma.doctorSchedule.findFirst({
      where: {
        doctorId,
        isActive: true,
        weekStartDate: toUtcDateOnly(slotPosition.weekStartIso),
        weekday: slotPosition.weekday,
        startTime,
        endTime,
      },
      select: { id: true },
    }),
  ]);

  if (!doctor) {
    return NextResponse.json({ message: "Врач не найден." }, { status: 404 });
  }
  if (!scheduleSlot) {
    return NextResponse.json({ message: "Этот слот уже недоступен." }, { status: 409 });
  }
  const candidatesAtSameSlot = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotDate: toUtcDateOnly(slotDate),
      startTime,
      endTime,
      status: {
        in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
      },
    },
    select: { id: true, slotDate: true, endTime: true },
  });
  const blockingAtSameSlot = candidatesAtSameSlot.find(
    (row) => !isAppointmentPast(row.slotDate.toISOString().slice(0, 10), row.endTime),
  );
  if (blockingAtSameSlot) {
    return NextResponse.json({ message: "Этот слот уже занят." }, { status: 409 });
  }

  try {
    await prisma.appointment.create({
      data: {
        doctorId,
        patientId: sessionUser.id,
        slotDate: toUtcDateOnly(slotDate),
        startTime,
        endTime,
        contactPhone: normalizedPhone,
        status: AppointmentStatus.PENDING,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ message: "Этот слот уже занят." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ message: "Вы успешно записаны на прием." }, { status: 201 });
}

export async function GET(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearRaw = Number(searchParams.get("year"));
  const monthRaw = Number(searchParams.get("month"));
  const now = new Date();
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : now.getFullYear();
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : now.getMonth() + 1;
  const monthFirstIso = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLastIso = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const rows = await prisma.appointment.findMany({
    where: {
      patientId: sessionUser.id,
      slotDate: {
        gte: toUtcDateOnly(monthFirstIso),
        lte: toUtcDateOnly(monthLastIso),
      },
    },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      slotDate: true,
      startTime: true,
      endTime: true,
      status: true,
      doctor: {
        select: {
          id: true,
          fullName: true,
          doctorSymptoms: true,
        },
      },
    },
  });

  const appointments = rows.map((row) => {
    const doctorMeta = parseDoctorMatchMeta(row.doctor.doctorSymptoms);
    return {
      id: row.id,
      slotDate: row.slotDate.toISOString().slice(0, 10),
      startTime: row.startTime,
      endTime: row.endTime,
      doctor: {
        id: row.doctor.id,
        fullName: row.doctor.fullName,
      },
      status: row.status,
      sessionPrice: doctorMeta.sessionPrice,
    };
  });

  return NextResponse.json({ year, month, appointments }, { status: 200 });
}
