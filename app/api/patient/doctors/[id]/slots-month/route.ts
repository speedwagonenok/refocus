import { AppointmentStatus, Role, Weekday } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAppointmentPast, slotDateToIsoDate } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";
import {
  addDaysToIsoDate,
  getSlotDateIso,
  getTodayLocalIsoDate,
  type WeekdayValue,
} from "@/lib/scheduleTime";
import { getSessionUser } from "@/lib/sessionUser";

function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function weekdayToValue(w: Weekday): WeekdayValue {
  return w as WeekdayValue;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const { id } = await params;
  const doctorId = Number(id);
  if (!Number.isInteger(doctorId) || doctorId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор." }, { status: 400 });
  }

  const doctor = await prisma.user.findFirst({
    where: { id: doctorId, role: Role.DOCTOR },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ message: "Врач не найден." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const now = new Date();
  const y = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const mo = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;

  const daysInMonth = new Date(y, mo, 0).getDate();
  const monthFirstIso = `${y}-${String(mo).padStart(2, "0")}-01`;
  const monthLastIso = `${y}-${String(mo).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const rangeStartIso = addDaysToIsoDate(monthFirstIso, -7);
  const rangeEndIso = addDaysToIsoDate(monthLastIso, 7);

  const rows = await prisma.doctorSchedule.findMany({
    where: {
      doctorId,
      isActive: true,
      weekStartDate: {
        gte: isoToUtcDate(rangeStartIso),
        lte: isoToUtcDate(rangeEndIso),
      },
    },
    select: {
      weekStartDate: true,
      weekday: true,
      startTime: true,
      endTime: true,
    },
  });
  const busySlots = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: {
        in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
      },
      slotDate: {
        gte: isoToUtcDate(monthFirstIso),
        lte: isoToUtcDate(monthLastIso),
      },
    },
    select: {
      slotDate: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  });
  const busySet = new Set(
    busySlots
      .filter((slot) => {
        const slotIso = slotDateToIsoDate(slot.slotDate);
        return !isAppointmentPast(slotIso, slot.endTime);
      })
      .map((slot) => `${slotDateToIsoDate(slot.slotDate)}|${slot.startTime}|${slot.endTime}`),
  );

  type Slot = { startTime: string; endTime: string };
  const slotsByDate: Record<string, Slot[]> = {};
  const seen = new Set<string>();
  const todayIso = getTodayLocalIsoDate();

  for (const row of rows) {
    const wk = row.weekStartDate.toISOString().slice(0, 10);
    const slotIso = getSlotDateIso(wk, weekdayToValue(row.weekday));
    const [sy, sm] = slotIso.split("-").map(Number);
    if (sy !== y || sm !== mo) continue;
    if (slotIso < todayIso) continue;

    const dedupeKey = `${slotIso}|${row.startTime}|${row.endTime}`;
    if (seen.has(dedupeKey)) continue;
    if (busySet.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (!slotsByDate[slotIso]) slotsByDate[slotIso] = [];
    slotsByDate[slotIso].push({ startTime: row.startTime, endTime: row.endTime });
  }

  for (const k of Object.keys(slotsByDate)) {
    slotsByDate[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return NextResponse.json({ year: y, month: mo, slotsByDate });
}
